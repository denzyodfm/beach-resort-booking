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
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";

export async function GET() {
  if (!hasPersistentKnowledgeStore()) {
    return Response.json({ items: getServerAutoReplyKnowledge(), mode: "demo" });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("auto_reply_knowledge")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({
      items: defaultAutoReplyKnowledge,
      mode: "setup_required",
      message: getSetupMessage(error.message),
    });
  }

  return Response.json({ items: (data || []).map(normalizeKnowledgeItem), mode: "supabase" });
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

  if (!hasPersistentKnowledgeStore()) {
    return Response.json(upsertServerAutoReplyKnowledge(item), { status: 201 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("auto_reply_knowledge")
    .insert(toKnowledgeRow(item))
    .select("*")
    .single();

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json(normalizeKnowledgeItem(data), { status: 201 });
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAutoReplyAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const item = {
    ...normalizeKnowledgeItem(await request.json()),
    updatedAt: new Date().toISOString(),
  };

  if (!item.id) return Response.json({ message: "Missing knowledge id." }, { status: 400 });

  if (!hasPersistentKnowledgeStore()) {
    return Response.json(upsertServerAutoReplyKnowledge(item));
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("auto_reply_knowledge")
    .update(toKnowledgeRow(item))
    .eq("id", item.id)
    .select("*")
    .single();

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json(normalizeKnowledgeItem(data));
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAutoReplyAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ message: "Missing knowledge id." }, { status: 400 });

  if (!hasPersistentKnowledgeStore()) {
    if (!deleteServerAutoReplyKnowledge(id)) return Response.json({ message: "Knowledge item not found." }, { status: 404 });
    return Response.json({ id });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("auto_reply_knowledge").delete().eq("id", id);

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json({ id });
}

function hasPersistentKnowledgeStore() {
  return hasSupabaseEnv() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function requireAutoReplyAdmin(request: Request) {
  if (hasPersistentKnowledgeStore()) return requireAdminUser();

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

function getSetupMessage(message: string) {
  if (message.includes("auto_reply_knowledge")) {
    return "Run supabase/auto-reply-knowledge-migration.sql in Supabase to enable persistent auto-reply knowledge.";
  }

  return message;
}
