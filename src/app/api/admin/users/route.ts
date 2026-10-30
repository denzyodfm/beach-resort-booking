import { randomUUID } from "node:crypto";

import { requireAdminUser } from "@/lib/admin-auth";
import { errorMessage, execute, query, toBoolean } from "@/lib/db";
import { hashPassword } from "@/lib/session";

type UserRole = "guest" | "staff" | "admin";

const validRoles = new Set<UserRole>(["guest", "staff", "admin"]);

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const profiles = await query(
      `select id, email, full_name, phone, role, disabled, last_sign_in_at, created_at, updated_at
         from users order by created_at desc`,
    );

    return Response.json(
      profiles.map((profile) => ({
        id: String(profile.id),
        email: String(profile.email || ""),
        fullName: String(profile.full_name || ""),
        phone: String(profile.phone || ""),
        role: validRoles.has(profile.role as UserRole) ? profile.role : "guest",
        disabled: toBoolean(profile.disabled),
        emailConfirmed: true,
        lastSignInAt: String(profile.last_sign_in_at || ""),
        createdAt: String(profile.created_at || ""),
        updatedAt: String(profile.updated_at || ""),
      })),
    );
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const role = normalizeRole(body.role);
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();
  const disabled = Boolean(body.disabled);

  if (!email || !password) {
    return Response.json({ message: "Email and password are required." }, { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return Response.json({ message: passwordError }, { status: 400 });

  try {
    const id = randomUUID();
    await execute(
      `insert into users (id, email, full_name, phone, role, password_hash, disabled)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [id, email, fullName, phone, role, await hashPassword(password), disabled ? 1 : 0],
    );

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ message: duplicateEmailMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const id = String(body.id || "");
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const role = normalizeRole(body.role);
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();
  const disabled = Boolean(body.disabled);

  if (!id || !email) {
    return Response.json({ message: "User id and email are required." }, { status: 400 });
  }

  if (id === adminCheck.userId && (disabled || role !== "admin")) {
    return Response.json({ message: "You cannot disable or remove admin access from your own account." }, { status: 409 });
  }

  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) return Response.json({ message: passwordError }, { status: 400 });
  }

  try {
    const result = password
      ? await execute(
          "update users set email = ?, full_name = ?, phone = ?, role = ?, disabled = ?, password_hash = ? where id = ?",
          [email, fullName, phone, role, disabled ? 1 : 0, await hashPassword(password), id],
        )
      : await execute("update users set email = ?, full_name = ?, phone = ?, role = ?, disabled = ? where id = ?", [
          email,
          fullName,
          phone,
          role,
          disabled ? 1 : 0,
          id,
        ]);

    if (!result.affectedRows) return Response.json({ message: "User not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ message: duplicateEmailMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id) return Response.json({ message: "User id is required." }, { status: 400 });
  if (id === adminCheck.userId) {
    return Response.json({ message: "You cannot delete your own admin account." }, { status: 409 });
  }

  try {
    await execute("delete from users where id = ?", [id]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value: unknown): UserRole {
  return validRoles.has(value as UserRole) ? (value as UserRole) : "guest";
}

/** Supabase enforced a 6-character minimum; keep the same floor. */
function validatePassword(password: string) {
  return password.length < 6 ? "Password should be at least 6 characters." : "";
}

function duplicateEmailMessage(error: unknown) {
  if (error && typeof error === "object" && (error as { code?: string }).code === "ER_DUP_ENTRY") {
    return "A user with this email address has already been registered.";
  }
  return errorMessage(error);
}
