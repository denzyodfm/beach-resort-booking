import "server-only";

import { createAdminClient, createClientServer, hasSupabaseEnv } from "@/lib/supabase-server";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export async function requireAdminUser(): Promise<AdminCheck> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      response: Response.json({ message: "Connect Supabase to manage users." }, { status: 501 }),
    };
  }

  const supabase = await createClientServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      ok: false,
      response: Response.json({ message: "Sign in as an admin to manage users." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      ok: false,
      response: Response.json({ message: "Only admin users can manage users." }, { status: 403 }),
    };
  }

  return { ok: true, userId: authData.user.id };
}
