import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { rooms } from "@/lib/resort-data";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(rooms);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("rooms").select("*").order("name");

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to create rooms." }, { status: 501 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { data, error } = await supabase.from("rooms").insert(body).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Connect Supabase to update cottages." }, { status: 501 });
  }

  const { id, image, ...body } = await request.json();
  const supabase = createAdminClient();

  const { data, error } = await supabase.from("rooms").update(body).eq("id", id).select().single();
  if (error) return Response.json({ message: error.message }, { status: 500 });

  if (image) {
    const { error: deleteImageError } = await supabase
      .from("room_images")
      .delete()
      .eq("room_id", id)
      .eq("is_primary", true);

    if (deleteImageError) return Response.json({ message: deleteImageError.message }, { status: 500 });

    const { error: imageError } = await supabase.from("room_images").insert({
      room_id: id,
      image_url: image,
      alt_text: `${data.name} cottage image`,
      is_primary: true,
      sort_order: 10,
    });

    if (imageError) return Response.json({ message: imageError.message }, { status: 500 });
  }

  return Response.json(data);
}
