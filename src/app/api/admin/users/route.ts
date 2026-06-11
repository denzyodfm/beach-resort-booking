import { requireAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

type UserRole = "guest" | "staff" | "admin";

const validRoles = new Set<UserRole>(["guest", "staff", "admin"]);
const longBanDuration = "876000h";

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) return adminCheck.response;

  const supabase = createAdminClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("users").select("id, email, full_name, phone, role, created_at, updated_at").order("created_at", {
      ascending: false,
    }),
  ]);

  if (authError) return Response.json({ message: authError.message }, { status: 500 });
  if (profilesError) return Response.json({ message: profilesError.message }, { status: 500 });

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const rows = authData.users.map((user) => {
    const profile = profileById.get(user.id);
    return {
      id: user.id,
      email: user.email || profile?.email || "",
      fullName: profile?.full_name || String(user.user_metadata?.full_name || ""),
      phone: profile?.phone || String(user.phone || ""),
      role: validRoles.has(profile?.role as UserRole) ? profile?.role : "guest",
      disabled: isDisabled(user.banned_until),
      emailConfirmed: Boolean(user.email_confirmed_at),
      lastSignInAt: user.last_sign_in_at || "",
      createdAt: profile?.created_at || user.created_at || "",
      updatedAt: profile?.updated_at || user.updated_at || "",
    };
  });

  return Response.json(rows);
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

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    ban_duration: disabled ? longBanDuration : "none",
  });

  if (authError || !authData.user) {
    return Response.json({ message: authError?.message || "Unable to create user." }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("users").upsert({
    id: authData.user.id,
    email,
    full_name: fullName,
    phone,
    role,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return Response.json({ message: profileError.message }, { status: 500 });
  }

  return Response.json({ id: authData.user.id }, { status: 201 });
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

  const supabase = createAdminClient();
  const authUpdates: {
    email: string;
    password?: string;
    user_metadata: { full_name: string };
    ban_duration: string;
  } = {
    email,
    user_metadata: { full_name: fullName },
    ban_duration: disabled ? longBanDuration : "none",
  };

  if (password) authUpdates.password = password;

  const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates);
  if (authError) return Response.json({ message: authError.message }, { status: 500 });

  const { error: profileError } = await supabase.from("users").upsert({
    id,
    email,
    full_name: fullName,
    phone,
    role,
  });

  if (profileError) return Response.json({ message: profileError.message }, { status: 500 });
  return Response.json({ ok: true });
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

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return Response.json({ message: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value: unknown): UserRole {
  return validRoles.has(value as UserRole) ? (value as UserRole) : "guest";
}

function isDisabled(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false;
  const timestamp = Date.parse(bannedUntil);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
