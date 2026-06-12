import type { Review } from "@/lib/types";

const reviews: Review[] = [
  {
    id: "REV-DEMO-1",
    roomId: "cottage_cove_1",
    roomName: "Cove 1",
    guestName: "Maria Santos",
    guestEmail: "maria@example.com",
    rating: 5,
    title: "Peaceful stay",
    body: "The cottage was clean, quiet, and close to the beach path.",
    status: "published",
    createdAt: new Date().toISOString(),
  },
];

export function getServerDemoReviews() {
  return reviews;
}

export function addServerDemoReview(review: Omit<Review, "id" | "status" | "createdAt">) {
  const nextReview: Review = {
    ...review,
    id: `REV-${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  reviews.unshift(nextReview);
  return nextReview;
}

export function updateServerDemoReview(id: string, updates: Partial<Review>) {
  const index = reviews.findIndex((review) => review.id === id);
  if (index === -1) return null;

  reviews[index] = { ...reviews[index], ...updates };
  return reviews[index];
}

export function deleteServerDemoReview(id: string) {
  const index = reviews.findIndex((review) => review.id === id);
  if (index === -1) return false;

  reviews.splice(index, 1);
  return true;
}
