import { hasSupabaseEnv } from "@/lib/supabase-server";

export async function GET() {
  return Response.json({
    bookingsMode: hasSupabaseEnv() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? "supabase"
      : "demo",
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
