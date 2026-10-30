import { requireResortManager } from "@/lib/admin-auth";
import { errorMessage, execute, hasDatabaseEnv, queryOne, toInsertClause, toSetClause } from "@/lib/db";
import { defaultCategories, normalizeCategory } from "@/lib/resort-data";
import { fetchCategoryRows } from "@/lib/rooms-server";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json(defaultCategories);
  }

  try {
    return Response.json((await fetchCategoryRows()).map(normalizeCategory));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to create categories." }, { status: 501 });
  }

  const row = toCategoryRow(await request.json());

  try {
    const insert = toInsertClause(row);
    await execute(`insert into room_categories (${insert.columns}) values (${insert.placeholders})`, insert.params);
    const data = await queryOne("select * from room_categories where id = ?", [row.id]);
    return Response.json(normalizeCategory(data || row), { status: 201 });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to update categories." }, { status: 501 });
  }

  const { id, ...updates } = toCategoryRow(await request.json());

  try {
    const set = toSetClause(updates);
    await execute(`update room_categories set ${set.sql} where id = ?`, [...set.params, id]);
    const data = await queryOne("select * from room_categories where id = ?", [id]);
    if (!data) return Response.json({ message: "Category not found." }, { status: 404 });
    return Response.json(normalizeCategory(data));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Connect the MySQL database to delete categories." }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing category id." }, { status: 400 });

  try {
    await execute("delete from room_categories where id = ?", [id]);
    return Response.json({ id });
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toCategoryRow(body: Record<string, unknown>) {
  const name = String(body.name || "New category");
  return {
    id: String(body.id || slugify(name)),
    name,
    description: String(body.description || ""),
    sort_order: Number(body.sortOrder ?? body.sort_order ?? 0),
  };
}
