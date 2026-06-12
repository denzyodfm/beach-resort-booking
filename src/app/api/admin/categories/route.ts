import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { defaultCategories, normalizeCategory } from "@/lib/resort-data";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(defaultCategories);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("room_categories").select("*").order("sort_order");

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json((data || []).map(normalizeCategory));
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to create categories." }, { status: 501 });
  }

  const body = await request.json();
  const row = toCategoryRow(body);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("room_categories").insert(row).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(normalizeCategory(data), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to update categories." }, { status: 501 });
  }

  const body = await request.json();
  const { id, ...updates } = toCategoryRow(body);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("room_categories").update(updates).eq("id", id).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(normalizeCategory(data));
}

export async function DELETE(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to delete categories." }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing category id." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("room_categories").delete().eq("id", id);

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

function toCategoryRow(body: Record<string, unknown>) {
  const name = String(body.name || "New category");
  return {
    id: String(body.id || slugify(name)),
    name,
    description: String(body.description || ""),
    sort_order: Number(body.sortOrder ?? body.sort_order ?? 0),
  };
}
