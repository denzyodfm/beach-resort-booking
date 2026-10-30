import { randomUUID } from "node:crypto";

import { errorMessage, execute, hasDatabaseEnv } from "@/lib/db";
import { addServerDemoReview, getServerDemoReviews } from "@/lib/demo-reviews-store";
import { fetchReviewRows } from "@/lib/record-queries";
import { getRoomById } from "@/lib/resort-data";
import { getRoomCatalog } from "@/lib/rooms-server";
import { normalizeReview } from "@/lib/reviews";

export async function GET() {
  if (!hasDatabaseEnv()) {
    return Response.json(getServerDemoReviews().filter((review) => review.status === "published"));
  }

  try {
    return Response.json((await fetchReviewRows("where v.is_published = 1")).map(normalizeReview));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const rating = Number(body.rating);
  const roomId = String(body.roomId || "");
  const guestName = String(body.guestName || "").trim();
  const guestEmail = String(body.guestEmail || "").trim();
  const title = String(body.title || "").trim();
  const reviewBody = String(body.body || "").trim();

  if (!roomId || !guestName || !reviewBody || rating < 1 || rating > 5) {
    return Response.json({ message: "Choose a cottage, rating, name, and review." }, { status: 400 });
  }

  const catalog = await getRoomCatalog();
  const room = catalog.rooms.find((item) => item.id === roomId) || getRoomById(roomId);
  if (!room) return Response.json({ message: "Cottage not found." }, { status: 404 });

  if (!hasDatabaseEnv()) {
    const review = addServerDemoReview({
      roomId,
      roomName: room.name,
      guestName,
      guestEmail,
      rating,
      title,
      body: reviewBody,
    });

    return Response.json(
      { review, message: "Thanks. Your review is waiting for admin approval." },
      { status: 201 },
    );
  }

  try {
    const id = randomUUID();
    await execute(
      `insert into reviews (id, room_id, rating, title, body, guest_name, guest_email, is_published)
       values (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, roomId, rating, title, reviewBody, guestName, guestEmail || null],
    );
    const [data] = await fetchReviewRows("where v.id = ?", [id]);

    return Response.json(
      { review: normalizeReview(data), message: "Thanks. Your review is waiting for admin approval." },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}
