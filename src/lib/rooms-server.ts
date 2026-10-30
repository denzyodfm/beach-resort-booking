import "server-only";

import { hasDatabaseEnv, parseJsonArray, query, type DbRow } from "@/lib/db";
import {
  defaultCategories,
  normalizeCategory,
  normalizeRoom,
  rooms as fallbackRooms,
} from "@/lib/resort-data";
import type { CottageCategory, Room } from "@/lib/types";

/**
 * Room rows in the shape normalizeRoom expects: snake_case columns plus nested
 * room_images and room_amenities arrays.
 */
export async function fetchRoomRows(options: { includeInactive?: boolean } = {}) {
  const [roomRows, imageRows, amenityRows] = await Promise.all([
    query(`select * from rooms ${options.includeInactive ? "" : "where is_active = 1"} order by sort_order`),
    query("select room_id, image_url from room_images order by is_primary desc, sort_order, created_at"),
    query(
      "select ra.room_id, a.name from room_amenities ra join amenities a on a.id = ra.amenity_id order by a.name",
    ),
  ]);

  const imagesByRoom = groupBy(imageRows, (row) => ({ image_url: String(row.image_url) }));
  const amenitiesByRoom = groupBy(amenityRows, (row) => ({ amenities: { name: String(row.name) } }));

  return roomRows.map((room) => ({
    ...room,
    booking_includes: parseJsonArray(room.booking_includes),
    room_images: imagesByRoom.get(String(room.id)) || [],
    room_amenities: amenitiesByRoom.get(String(room.id)) || [],
  }));
}

export async function fetchCategoryRows() {
  return query("select * from room_categories order by sort_order");
}

export async function getRoomCatalog(options: { includeInactive?: boolean } = {}): Promise<{ rooms: Room[]; categories: CottageCategory[] }> {
  if (!hasDatabaseEnv()) {
    return { rooms: fallbackRooms, categories: defaultCategories };
  }

  try {
    const [categoryRows, roomRows] = await Promise.all([fetchCategoryRows(), fetchRoomRows(options)]);
    const categories = categoryRows.length ? categoryRows.map(normalizeCategory) : defaultCategories;
    const normalizedRooms = roomRows.length ? roomRows.map((room) => normalizeRoom(room, categories)) : fallbackRooms;

    return { rooms: normalizedRooms, categories };
  } catch {
    return { rooms: fallbackRooms, categories: defaultCategories };
  }
}

export async function getRoomBySlugFromCatalog(slug: string) {
  const catalog = await getRoomCatalog();
  return catalog.rooms.find((room) => room.slug === slug);
}

function groupBy<T>(rows: DbRow[], map: (row: DbRow) => T) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row.room_id);
    const list = grouped.get(key) || [];
    list.push(map(row));
    grouped.set(key, list);
  }
  return grouped;
}
