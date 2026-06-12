import {
  deleteServerDemoReview,
  getServerDemoReviews,
  updateServerDemoReview,
} from "@/lib/demo-reviews-store";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { normalizeReview } from "@/lib/reviews";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(getServerDemoReviews());
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, rooms(name)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json((data || []).map(normalizeReview));
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();
  if (!id || !["pending", "published"].includes(status)) {
    return Response.json({ message: "Missing review id or status." }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const updated = updateServerDemoReview(id, { status });
    if (!updated) return Response.json({ message: "Review not found." }, { status: 404 });
    return Response.json(updated);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ is_published: status === "published" })
    .eq("id", id)
    .select("*, rooms(name)")
    .single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(normalizeReview(data));
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing review id." }, { status: 400 });

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!deleteServerDemoReview(id)) return Response.json({ message: "Review not found." }, { status: 404 });
    return Response.json({ id });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json({ id });
}
