import { execute, hasDatabaseEnv, query, toBoolean } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/session";

const invalidLogin = "Invalid username/email or password.";

export async function POST(request: Request) {
  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Account login is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as { identifier?: string; password?: string };
  const identifier = body.identifier?.trim() || "";
  const password = body.password || "";

  if (!identifier || !password || identifier.length > 255) {
    return Response.json({ message: "Enter your username or email and password." }, { status: 400 });
  }

  // Staff may sign in with their full name instead of an email. A name must
  // match exactly one staff or admin account to count.
  const rows = identifier.includes("@")
    ? await query("select * from users where email = ? limit 1", [identifier.toLowerCase()])
    : await query("select * from users where full_name = ? and role in ('admin', 'staff') limit 2", [identifier]);

  const user = rows.length === 1 ? rows[0] : null;
  const passwordOk = await verifyPassword(password, user ? String(user.password_hash || "") : null);

  if (!user || !passwordOk) {
    return Response.json({ message: invalidLogin }, { status: 401 });
  }

  if (toBoolean(user.disabled)) {
    return Response.json({ message: "This account is disabled." }, { status: 403 });
  }

  if (user.role !== "admin" && user.role !== "staff") {
    return Response.json({ message: "This account is not marked as admin or staff." }, { status: 403 });
  }

  await execute("update users set last_sign_in_at = utc_timestamp(3) where id = ?", [user.id]);
  await createSession(String(user.id));

  return Response.json({
    user: {
      id: String(user.id),
      name: String(user.full_name || user.email),
      email: String(user.email),
      phone: String(user.phone || ""),
      role: user.role,
    },
  });
}
