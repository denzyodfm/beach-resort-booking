import { getSessionUser } from "@/lib/admin-auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ user: null });

  return Response.json({
    user: {
      id: user.id,
      name: user.fullName || user.email,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
}
