import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { defaultCategories, normalizeCategory, normalizeRoom, rooms } from "@/lib/resort-data";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ rooms, categories: defaultCategories });
  }

  const supabase = createAdminClient();
  const [{ data: categoryRows, error: categoryError }, { data: roomRows, error: roomError }] = await Promise.all([
    supabase.from("room_categories").select("*").order("sort_order"),
    supabase.from("rooms").select("*, room_images(image_url), room_amenities(amenities(name))").order("sort_order"),
  ]);

  if (roomError) return Response.json({ message: roomError.message }, { status: 500 });

  const categories = !categoryError && categoryRows?.length ? categoryRows.map(normalizeCategory) : defaultCategories;
  return Response.json({
    rooms: (roomRows || []).map((room) => normalizeRoom(room, categories)),
    categories,
  });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to create rooms." }, { status: 501 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const room = toRoomRow(body);
  const { image, amenities, ...roomRow } = room;
  const { data, error } = await supabase.from("rooms").insert(roomRow).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });

  const assetError = await syncRoomAssets(supabase, data.id, data.name, image, amenities);
  if (assetError) return Response.json({ message: assetError }, { status: 500 });

  return Response.json(normalizeRoom({ ...data, image, amenities }), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to update cottages." }, { status: 501 });
  }

  const body = await request.json();
  const { id, image, amenities, ...roomRow } = toRoomRow(body);
  const supabase = createAdminClient();

  const { data, error } = await supabase.from("rooms").update(roomRow).eq("id", id).select().single();
  if (error) return Response.json({ message: error.message }, { status: 500 });

  const assetError = await syncRoomAssets(supabase, id, data.name, image, amenities);
  if (assetError) return Response.json({ message: assetError }, { status: 500 });

  return Response.json(normalizeRoom({ ...data, image, amenities }));
}

export async function DELETE(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to delete cottages." }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing cottage id." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id);

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json({ id });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toRoomRow(body: Record<string, unknown>) {
  const name = String(body.name || "New cottage");
  const categoryId = String(body.categoryId || body.category_id || body.type || "cove");
  const id = String(body.id || `cottage_${categoryId}_${Date.now()}`);
  const size = String(body.size || "");

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
    booking_includes: Array.isArray(body.bookingIncludes || body.booking_includes)
      ? (body.bookingIncludes || body.booking_includes)
      : [],
    image: String(body.image || ""),
    amenities: Array.isArray(body.amenities) ? body.amenities.map(String) : [],
  };
}

async function syncRoomAssets(
  supabase: ReturnType<typeof createAdminClient>,
  roomId: string,
  roomName: string,
  image: string,
  amenities: string[],
) {
  if (image) {
    const { error: deleteImageError } = await supabase
      .from("room_images")
      .delete()
      .eq("room_id", roomId)
      .eq("is_primary", true);

    if (deleteImageError) return deleteImageError.message;

    const { error: imageError } = await supabase.from("room_images").insert({
      room_id: roomId,
      image_url: image,
      alt_text: `${roomName} cottage image`,
      is_primary: true,
      sort_order: 10,
    });

    if (imageError) return imageError.message;
  }

  const { error: deleteAmenitiesError } = await supabase.from("room_amenities").delete().eq("room_id", roomId);
  if (deleteAmenitiesError) return deleteAmenitiesError.message;

  for (const amenity of amenities) {
    const { data, error } = await supabase
      .from("amenities")
      .upsert({ name: amenity }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) return error.message;

    const { error: linkError } = await supabase.from("room_amenities").insert({
      room_id: roomId,
      amenity_id: data.id,
    });
    if (linkError) return linkError.message;
  }

  return "";
}
