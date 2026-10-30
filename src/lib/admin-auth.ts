import "server-only";

import { hasDatabaseEnv, queryOne, toBoolean } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export type ResortRole = "guest" | "staff" | "admin";

export type AdminCheck =
  | { ok: true; userId: string; role: ResortRole }
  | { ok: false; response: Response };

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: ResortRole;
};

/** The signed-in, non-disabled user, read fresh from the database on every call. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!hasDatabaseEnv()) return null;

  try {
    const userId = await getSessionUserId();
    if (!userId) return null;

    const profile = await queryOne("select id, email, full_name, phone, role, disabled from users where id = ?", [userId]);
    if (!profile || toBoolean(profile.disabled)) return null;

    return {
      id: String(profile.id),
      email: String(profile.email || ""),
      fullName: String(profile.full_name || ""),
      phone: String(profile.phone || ""),
      role: (profile.role || "guest") as ResortRole,
    };
  } catch {
    return null;
  }
}

async function resolveSessionRole(): Promise<{ userId: string; role: ResortRole } | null> {
  const user = await getSessionUser();
  return user ? { userId: user.id, role: user.role } : null;
}

/** Admin only. Used for account management, where staff must not reach. */
export async function requireAdminUser(): Promise<AdminCheck> {
  if (!hasDatabaseEnv()) {
    return {
      ok: false,
      response: Response.json({ message: "Connect the MySQL database to manage users." }, { status: 501 }),
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
 * before. The guard only takes effect once the database is configured, which is
 * the deployed case.
 */
export async function requireResortManager(): Promise<AdminCheck> {
  if (!hasDatabaseEnv()) {
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
  if (!hasDatabaseEnv()) return false;

  const session = await resolveSessionRole();
  return session?.role === "admin" || session?.role === "staff";
}
