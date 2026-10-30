import { hasDatabaseEnv } from "@/lib/db";
import { getServerDemoReviews } from "@/lib/demo-reviews-store";
import { fetchReviewRows } from "@/lib/record-queries";
import { normalizeReview } from "@/lib/reviews";
import type { Review } from "@/lib/types";

export async function getPublishedReviews(): Promise<Review[]> {
  if (!hasDatabaseEnv()) {
    return getServerDemoReviews().filter((review) => review.status === "published");
  }

  try {
    return (await fetchReviewRows("where v.is_published = 1")).map(normalizeReview);
  } catch {
    return [];
  }
}
