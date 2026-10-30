import { hasDatabaseEnv } from "@/lib/db";

export async function GET() {
  return Response.json({
    bookingsMode: hasDatabaseEnv() ? "mysql" : "demo",
    hasDatabaseUrl: hasDatabaseEnv(),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
  });
}
