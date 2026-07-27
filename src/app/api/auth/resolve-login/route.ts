import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: "Account login is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as { identifier?: string };
  const identifier = body.identifier?.trim();

  if (!identifier || identifier.includes("@") || identifier.length > 100) {
    return Response.json({ message: "Invalid username/email or password." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .ilike("full_name", identifier)
    .in("role", ["admin", "staff"])
    .limit(2);

  if (error) {
    return Response.json({ message: "Unable to sign in right now." }, { status: 500 });
  }

  if (!data || data.length !== 1 || !data[0].email) {
    return Response.json({ message: "Invalid username/email or password." }, { status: 401 });
  }

  return Response.json({ email: data[0].email });
}
