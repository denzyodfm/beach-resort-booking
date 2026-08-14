import "server-only";

import { createAdminClient, createClientServer, hasSupabaseEnv } from "@/lib/supabase-server";

export type ResortRole = "guest" | "staff" | "admin";

export type AdminCheck =
  | { ok: true; userId: string; role: ResortRole }
  | { ok: false; response: Response };

export function hasConfiguredSupabase() {
  return hasSupabaseEnv() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveSessionRole(): Promise<{ userId: string; role: ResortRole } | null> {
  try {
    const supabase = await createClientServer();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) return null;

    return { userId: authData.user.id, role: (profile.role || "guest") as ResortRole };
  } catch {
    return null;
  }
}

/** Admin only. Used for account management, where staff must not reach. */
export async function requireAdminUser(): Promise<AdminCheck> {
  if (!hasConfiguredSupabase()) {
    return {
      ok: false,
      response: Response.json({ message: "Connect Supabase to manage users." }, { status: 501 }),
    };
  }

  const session = await resolveSessionRole();

  if (!session) {
    return {
      ok: false,
      response: Response.json({ message: "Sign in as an admin to manage users." }, { status: 401 }),
    };
  }

  if (session.role !== "admin") {
    return {
      ok: false,
      response: Response.json({ message: "Only admin users can manage users." }, { status: 403 }),
    };
  }

  return { ok: true, ...session };
}

/**
 * Staff or admin. Used for day-to-day resort operations: bookings, cottages,
 * categories, reviews, and blocked dates.
 *
 * Demo mode has no accounts and no real guest data, so it stays open exactly as
 * before. The guard only takes effect once Supabase is configured, which is the
 * deployed case.
 */
export async function requireResortManager(): Promise<AdminCheck> {
  if (!hasConfiguredSupabase()) {
    return { ok: true, userId: "demo-manager", role: "admin" };
  }

  const session = await resolveSessionRole();

  if (!session) {
    return {
      ok: false,
      response: Response.json({ message: "Sign in as staff or admin to manage the resort." }, { status: 401 }),
    };
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return {
      ok: false,
      response: Response.json({ message: "Only staff or admin users can manage the resort." }, { status: 403 }),
    };
  }

  return { ok: true, ...session };
}

/** Non-throwing check for endpoints that serve both guests and managers. */
export async function isResortManager() {
  if (!hasConfiguredSupabase()) return false;

  const session = await resolveSessionRole();
  return session?.role === "admin" || session?.role === "staff";
}
