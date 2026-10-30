import { randomUUID } from "node:crypto";

import { requireResortManager } from "@/lib/admin-auth";
import { normalizeBlockedDate } from "@/lib/booking-blocked-dates";
import {
  addServerBlockedDate,
  deleteServerBlockedDate,
  getServerBlockedDates,
} from "@/lib/booking-blocked-dates-store";
import { errorMessage, execute, hasDatabaseEnv, isMissingTableError, query, queryOne } from "@/lib/db";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json(getServerBlockedDates());
  }

  try {
    const data = await query("select * from booking_blackout_dates order by blocked_date");
    return Response.json(data.map(normalizeBlockedDate));
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as Record<string, unknown>;
  const date = String(body.date || body.blocked_date || "").trim();
  const label = String(body.label || body.name || "Philippine holiday").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ message: "Select a valid holiday date." }, { status: 400 });
  }

  if (!hasDatabaseEnv()) {
    return Response.json(
      addServerBlockedDate({
        id: date,
        date,
        label,
        createdAt: new Date().toISOString(),
      }),
      { status: 201 },
    );
  }

  try {
    await execute(
      `insert into booking_blackout_dates (id, blocked_date, label) values (?, ?, ?)
       on duplicate key update label = values(label)`,
      [randomUUID(), date, label],
    );
    const data = await queryOne("select * from booking_blackout_dates where blocked_date = ?", [date]);
    return Response.json(normalizeBlockedDate(data || {}), { status: 201 });
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return Response.json({ message: "Missing holiday id." }, { status: 400 });

  if (!hasDatabaseEnv()) {
    const deleted = deleteServerBlockedDate(id);
    if (!deleted) return Response.json({ message: "Holiday date not found." }, { status: 404 });
    return Response.json(deleted);
  }

  try {
    await execute("delete from booking_blackout_dates where id = ?", [id]);
    return Response.json({ id });
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

function getSetupMessage(error: unknown) {
  if (isMissingTableError(error)) {
    return "Holiday table is not ready. Run mysql/schema.sql to create booking_blackout_dates.";
  }

  return errorMessage(error);
}
