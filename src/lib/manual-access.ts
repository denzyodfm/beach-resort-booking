import "server-only";

import { getSessionUser } from "@/lib/admin-auth";
import { hasDatabaseEnv } from "@/lib/db";
import type { ManualRole } from "@/lib/manuals";

/**
 * Guest manual: anyone. Staff manual: staff and admins. Admin manual: admins.
 * Demo mode has no accounts, so every manual is open there.
 */
export async function canOpenManual(role: ManualRole) {
  if (role === "guest" || !hasDatabaseEnv()) return true;

  const user = await getSessionUser();
  if (role === "staff") return user?.role === "staff" || user?.role === "admin";
  return user?.role === "admin";
}
