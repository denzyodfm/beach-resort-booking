import { randomUUID } from "node:crypto";

import type { PoolConnection } from "mysql2/promise";

import { requireResortManager } from "@/lib/admin-auth";
import {
  errorMessage,
  execute,
  hasDatabaseEnv,
  parseJsonArray,
  queryOne,
  toInsertClause,
  toSetClause,
  transaction,
} from "@/lib/db";
import { defaultCategories, normalizeCategory, normalizeRoom, onlineReservablePrefix, premiumFeePrefix, reservationFeePrefix, reservationHoldPrefix, rooms } from "@/lib/resort-data";
import { fetchCategoryRows, fetchRoomRows } from "@/lib/rooms-server";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ rooms, categories: defaultCategories });
  }

  try {
    const [categoryRows, roomRows] = await Promise.all([
      fetchCategoryRows().catch(() => []),
      fetchRoomRows({ includeInactive: true }),
    ]);

    const categories = categoryRows.length ? categoryRows.map(normalizeCategory) : defaultCategories;
    return Response.json({
      rooms: roomRows.map((room) => normalizeRoom(room, categories)),
      categories,
    });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to create rooms." }, { status: 501 });
  }

  const { image, amenities, ...roomRow } = toRoomRow(await request.json());

  try {
    const data = await transaction(async (connection) => {
      const insert = toInsertClause(roomRow);
      await execute(`insert into rooms (${insert.columns}) values (${insert.placeholders})`, insert.params, connection);
      await syncRoomAssets(connection, roomRow.id, roomRow.name, image, amenities);
      return queryOne("select * from rooms where id = ?", [roomRow.id], connection);
    });

    return Response.json(normalizeRoom({ ...fromRoomRow(data), image, amenities }), { status: 201 });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to update cottages." }, { status: 501 });
  }

  const { id, image, amenities, ...roomRow } = toRoomRow(await request.json());

  try {
    const data = await transaction(async (connection) => {
      const set = toSetClause(roomRow);
      await execute(`update rooms set ${set.sql} where id = ?`, [...set.params, id], connection);
      const row = await queryOne("select * from rooms where id = ?", [id], connection);
      if (!row) return null;

      await syncRoomAssets(connection, id, String(row.name), image, amenities);
      return row;
    });

    if (!data) return Response.json({ message: "Cottage not found." }, { status: 404 });
    return Response.json(normalizeRoom({ ...fromRoomRow(data), image, amenities }));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to delete cottages." }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing cottage id." }, { status: 400 });

  try {
    await execute("delete from rooms where id = ?", [id]);
    return Response.json({ id });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fromRoomRow(row: Record<string, unknown> | null) {
  return { ...row, booking_includes: parseJsonArray(row?.booking_includes) };
}

function toRoomRow(body: Record<string, unknown>) {
  const name = String(body.name || "New cottage");
  const categoryId = String(body.categoryId || body.category_id || body.type || "cove");
  const id = String(body.id || `cottage_${categoryId}_${Date.now()}`);
  const size = String(body.size || "");
  const rawIncludes = body.bookingIncludes || body.booking_includes;
  const bookingIncludes = Array.isArray(rawIncludes)
    ? rawIncludes.map(String).filter((value) =>
        ![reservationHoldPrefix, premiumFeePrefix, reservationFeePrefix, onlineReservablePrefix].some((prefix) => value.startsWith(prefix)),
      )
    : [];

  return {
    id,
    slug: String(body.slug || slugify(name)),
    name,
    type: categoryId,
    category_id: categoryId,
    description: String(body.description || ""),
    long_description: String(body.longDescription || body.long_description || body.description || ""),
    price_per_night: Number(body.pricePerNight ?? body.price_per_night ?? 0),
    max_guests: Number(body.maxGuests ?? body.max_guests ?? 1),
    bedrooms: Number(body.bedrooms ?? 1),
    bathrooms: Number(body.bathrooms ?? 1),
    size_sq_ft: Number(size) || null,
    is_active: Boolean(body.available ?? body.is_active ?? true),
    is_featured: Boolean(body.featured ?? body.is_featured ?? false),
    sort_order: Number(body.sortOrder ?? body.sort_order ?? 0),
    booking_includes: [
      ...bookingIncludes,
      `${reservationHoldPrefix}${Math.max(1, Number(body.reservationHoldHours) || 24)}`,
      `${onlineReservablePrefix}${body.onlineReservable !== false}`,
      ...(body.onlineReservable !== false && Boolean(body.premiumFeeEnabled) && Number(body.premiumFeeAmount) > 0
        ? [`${premiumFeePrefix}${Number(body.premiumFeeAmount)}`]
        : []),
      ...(body.onlineReservable !== false && Boolean(body.reservationFeeEnabled) && Number(body.reservationFeeAmount) > 0
        ? [`${reservationFeePrefix}${Number(body.reservationFeeAmount)}`]
        : []),
    ],
    image: String(body.image || ""),
    amenities: Array.isArray(body.amenities) ? body.amenities.map(String) : [],
  };
}

async function syncRoomAssets(
  connection: PoolConnection,
  roomId: string,
  roomName: string,
  image: string,
  amenities: string[],
) {
  if (image) {
    await execute("delete from room_images where room_id = ? and is_primary = 1", [roomId], connection);
    await execute(
      `insert into room_images (id, room_id, image_url, alt_text, is_primary, sort_order)
       values (?, ?, ?, ?, 1, 10)`,
      [randomUUID(), roomId, image, `${roomName} cottage image`],
      connection,
    );
  }

  await execute("delete from room_amenities where room_id = ?", [roomId], connection);

  for (const amenity of amenities) {
    await execute("insert ignore into amenities (id, name) values (?, ?)", [randomUUID(), amenity], connection);
    const row = await queryOne("select id from amenities where name = ?", [amenity], connection);
    if (!row) continue;

    await execute("insert ignore into room_amenities (room_id, amenity_id) values (?, ?)", [roomId, row.id], connection);
  }
}
