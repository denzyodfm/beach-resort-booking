import { ReviewForm } from "@/components/review-form";
import { getPublishedReviews } from "@/lib/reviews-server";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [{ rooms }, reviews] = await Promise.all([getRoomCatalog(), getPublishedReviews()]);

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Reviews</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Share your BOLIHON experience</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Guest reviews are sent to the admin dashboard first. Approved reviews appear here for future guests.
        </p>

        <div className="mt-8 grid gap-4">
          {reviews.map((review) => (
            <figure key={review.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-bold text-cyan-800">{review.roomName}</p>
                  <blockquote className="mt-2 text-lg font-semibold leading-7 text-slate-950">
                    &ldquo;{review.title || review.body}&rdquo;
                  </blockquote>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                  {review.rating}/5
                </span>
              </div>
              {review.title ? <p className="mt-3 text-sm leading-6 text-slate-600">{review.body}</p> : null}
              <figcaption className="mt-4 text-sm text-slate-500">{review.guestName}</figcaption>
            </figure>
          ))}
          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No approved reviews yet.
            </div>
          ) : null}
        </div>
      </div>

      <ReviewForm rooms={rooms} />
    </section>
  );
}
