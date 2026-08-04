import "server-only";

import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import {
  defaultCategories,
  normalizeCategory,
  normalizeRoom,
  rooms as fallbackRooms,
} from "@/lib/resort-data";
import type { CottageCategory, Room } from "@/lib/types";

export async function getRoomCatalog(options: { includeInactive?: boolean } = {}): Promise<{ rooms: Room[]; categories: CottageCategory[] }> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rooms: fallbackRooms, categories: defaultCategories };
  }

  const supabase = createAdminClient();
  let roomsQuery = supabase
    .from("rooms")
    .select("*, room_images(image_url), room_amenities(amenities(name))")
    .order("sort_order");

  if (!options.includeInactive) roomsQuery = roomsQuery.eq("is_active", true);

  const [{ data: categoryRows, error: categoryError }, { data: roomRows, error: roomError }] = await Promise.all([
    supabase.from("room_categories").select("*").order("sort_order"),
    roomsQuery,
  ]);

  if (categoryError || roomError) {
    return { rooms: fallbackRooms, categories: defaultCategories };
  }

  const categories = categoryRows?.length ? categoryRows.map(normalizeCategory) : defaultCategories;
  const normalizedRooms = roomRows?.length ? roomRows.map((room) => normalizeRoom(room, categories)) : fallbackRooms;

  return { rooms: normalizedRooms, categories };
}

export async function getRoomBySlugFromCatalog(slug: string) {
  const catalog = await getRoomCatalog();
  return catalog.rooms.find((room) => room.slug === slug);
}
