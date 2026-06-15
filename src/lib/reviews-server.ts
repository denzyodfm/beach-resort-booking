import { getServerDemoReviews } from "@/lib/demo-reviews-store";
import { normalizeReview } from "@/lib/reviews";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import type { Review } from "@/lib/types";

export async function getPublishedReviews(): Promise<Review[]> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getServerDemoReviews().filter((review) => review.status === "published");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, rooms(name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data || []).map(normalizeReview);
}
