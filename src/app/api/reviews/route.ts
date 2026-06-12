import { addServerDemoReview, getServerDemoReviews } from "@/lib/demo-reviews-store";
import { getRoomById } from "@/lib/resort-data";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { getRoomCatalog } from "@/lib/rooms-server";
import { normalizeReview } from "@/lib/reviews";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(getServerDemoReviews().filter((review) => review.status === "published"));
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, rooms(name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json((data || []).map(normalizeReview));
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

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      room_id: roomId,
      rating,
      title,
      body: reviewBody,
      guest_name: guestName,
      guest_email: guestEmail || null,
      is_published: false,
    })
    .select("*, rooms(name)")
    .single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(
    { review: normalizeReview(data), message: "Thanks. Your review is waiting for admin approval." },
    { status: 201 },
  );
}
