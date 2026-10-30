import { requireResortManager } from "@/lib/admin-auth";
import { errorMessage, execute, hasDatabaseEnv } from "@/lib/db";
import {
  deleteServerDemoReview,
  getServerDemoReviews,
  updateServerDemoReview,
} from "@/lib/demo-reviews-store";
import { fetchReviewRows } from "@/lib/record-queries";
import { normalizeReview } from "@/lib/reviews";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json(getServerDemoReviews());
  }

  try {
    return Response.json((await fetchReviewRows()).map(normalizeReview));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const { id, status } = await request.json();
  if (!id || !["pending", "published"].includes(status)) {
    return Response.json({ message: "Missing review id or status." }, { status: 400 });
  }

  if (!hasDatabaseEnv()) {
    const updated = updateServerDemoReview(id, { status });
    if (!updated) return Response.json({ message: "Review not found." }, { status: 404 });
    return Response.json(updated);
  }

  try {
    await execute("update reviews set is_published = ? where id = ?", [status === "published" ? 1 : 0, id]);
    const [data] = await fetchReviewRows("where v.id = ?", [id]);
    if (!data) return Response.json({ message: "Review not found." }, { status: 404 });
    return Response.json(normalizeReview(data));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing review id." }, { status: 400 });

  if (!hasDatabaseEnv()) {
    if (!deleteServerDemoReview(id)) return Response.json({ message: "Review not found." }, { status: 404 });
    return Response.json({ id });
  }

  try {
    await execute("delete from reviews where id = ?", [id]);
    return Response.json({ id });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}
