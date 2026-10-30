import {
  defaultAutoReplyKnowledge,
  normalizeKnowledgeItem,
  type AutoReplyKnowledgeItem,
} from "@/lib/auto-reply-knowledge";
import {
  deleteServerAutoReplyKnowledge,
  getServerAutoReplyKnowledge,
  upsertServerAutoReplyKnowledge,
} from "@/lib/auto-reply-knowledge-store";
import { requireAdminUser } from "@/lib/admin-auth";
import {
  errorMessage,
  execute,
  hasDatabaseEnv,
  isMissingTableError,
  parseJsonArray,
  query,
  queryOne,
  toInsertClause,
  toSetClause,
  type DbRow,
} from "@/lib/db";

export async function GET() {
  if (!hasDatabaseEnv()) {
    return Response.json({ items: getServerAutoReplyKnowledge(), mode: "demo" });
  }

  try {
    const data = await query("select * from auto_reply_knowledge order by sort_order asc, created_at asc");
    return Response.json({ items: data.map(fromKnowledgeRow), mode: "database" });
  } catch (error) {
    return Response.json({
      items: defaultAutoReplyKnowledge,
      mode: "setup_required",
      message: getSetupMessage(error),
    });
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAutoReplyAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = normalizeKnowledgeItem(await request.json());
  const item = {
    ...body,
    id: body.id.startsWith("default-") ? createKnowledgeId() : body.id || createKnowledgeId(),
    updatedAt: new Date().toISOString(),
  };

  if (!hasDatabaseEnv()) {
    return Response.json(upsertServerAutoReplyKnowledge(item), { status: 201 });
  }

  try {
    const insert = toInsertClause(toKnowledgeRow(item));
    await execute(`insert into auto_reply_knowledge (${insert.columns}) values (${insert.placeholders})`, insert.params);
    const data = await queryOne("select * from auto_reply_knowledge where id = ?", [item.id]);
    return Response.json(fromKnowledgeRow(data || {}), { status: 201 });
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAutoReplyAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const item = {
    ...normalizeKnowledgeItem(await request.json()),
    updatedAt: new Date().toISOString(),
  };

  if (!item.id) return Response.json({ message: "Missing knowledge id." }, { status: 400 });

  if (!hasDatabaseEnv()) {
    return Response.json(upsertServerAutoReplyKnowledge(item));
  }

  try {
    const { id, ...updates } = toKnowledgeRow(item);
    const set = toSetClause(updates);
    await execute(`update auto_reply_knowledge set ${set.sql} where id = ?`, [...set.params, id]);
    const data = await queryOne("select * from auto_reply_knowledge where id = ?", [id]);
    if (!data) return Response.json({ message: "Knowledge item not found." }, { status: 404 });
    return Response.json(fromKnowledgeRow(data));
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAutoReplyAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing knowledge id." }, { status: 400 });

  if (!hasDatabaseEnv()) {
    if (!deleteServerAutoReplyKnowledge(id)) return Response.json({ message: "Knowledge item not found." }, { status: 404 });
    return Response.json({ id });
  }

  try {
    await execute("delete from auto_reply_knowledge where id = ?", [id]);
    return Response.json({ id });
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

async function requireAutoReplyAdmin(request: Request) {
  if (hasDatabaseEnv()) return requireAdminUser();

  if (request.headers.get("x-demo-role") === "admin") {
    return { ok: true as const, userId: "demo-admin" };
  }

  return {
    ok: false as const,
    response: Response.json({ message: "Only admin users can manage auto-reply knowledge." }, { status: 403 }),
  };
}

function createKnowledgeId() {
  return `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fromKnowledgeRow(row: DbRow) {
  return normalizeKnowledgeItem({ ...row, keywords: parseJsonArray(row.keywords) });
}

function toKnowledgeRow(item: AutoReplyKnowledgeItem) {
  return {
    id: item.id,
    title: item.title,
    keywords: item.keywords,
    response: item.response,
    sort_order: item.sortOrder,
    updated_at: item.updatedAt,
  };
}

function getSetupMessage(error: unknown) {
  if (isMissingTableError(error)) {
    return "Run mysql/schema.sql to create the auto_reply_knowledge table.";
  }

  return errorMessage(error);
}
