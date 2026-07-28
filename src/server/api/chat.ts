import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { CHATBOT_GREETING } from "@/data/chatbotResponses";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { ChatMessage, ChatSession, ChatSessionStatus } from "@/types/chat";

const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  senderType: z.enum(["customer", "bot", "agent"]),
  senderName: z.string(),
  text: z.string(),
  createdAt: z.string(),
  isRead: z.boolean(),
});

const sessionSchema = z.object({
  id: z.string(),
  companyId: z.string().optional(),
  portalSlug: z.string().optional(),
  visitorName: z.string(),
  status: z.enum(["bot-handling", "waiting-for-agent", "agent-active", "closed"]),
  assignedAgentId: z.string().optional(),
  assignedAgentName: z.string().optional(),
  linkedTicketId: z.string().optional(),
  botAttempts: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(messageSchema),
});

function mapMessage(row: typeof t.chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    senderType: row.senderType as ChatMessage["senderType"],
    senderName: row.senderName,
    text: row.text,
    createdAt: row.createdAt,
    isRead: row.isRead,
  };
}

function mapSession(
  row: typeof t.chatSessions.$inferSelect,
  messages: typeof t.chatMessages.$inferSelect[],
): ChatSession {
  return {
    id: row.id,
    companyId: row.companyId ?? undefined,
    portalSlug: row.portalSlug ?? undefined,
    visitorName: row.visitorName,
    status: row.status as ChatSessionStatus,
    assignedAgentId: row.assignedAgentId ?? undefined,
    assignedAgentName: row.assignedAgentName ?? undefined,
    linkedTicketId: row.linkedTicketId ?? undefined,
    botAttempts: row.botAttempts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    messages: messages.map(mapMessage),
  };
}

function loadSession(db: ReturnType<typeof getDb>, sessionId: string): ChatSession | null {
  const row = db.select().from(t.chatSessions).where(eq(t.chatSessions.id, sessionId)).get();
  if (!row) return null;
  const messages = db
    .select()
    .from(t.chatMessages)
    .where(eq(t.chatMessages.sessionId, sessionId))
    .orderBy(asc(t.chatMessages.createdAt))
    .all();
  return mapSession(row, messages);
}

function loadAllSessions(db: ReturnType<typeof getDb>): ChatSession[] {
  const rows = db.select().from(t.chatSessions).orderBy(desc(t.chatSessions.updatedAt)).all();
  if (rows.length === 0) return [];

  const sessionIds = rows.map((r) => r.id);
  const allMessages = db
    .select()
    .from(t.chatMessages)
    .orderBy(asc(t.chatMessages.createdAt))
    .all()
    .filter((m) => sessionIds.includes(m.sessionId));

  const bySession = new Map<string, typeof t.chatMessages.$inferSelect[]>();
  for (const msg of allMessages) {
    const list = bySession.get(msg.sessionId) ?? [];
    list.push(msg);
    bySession.set(msg.sessionId, list);
  }

  return rows.map((row) => mapSession(row, bySession.get(row.id) ?? []));
}

function resolveActivePortal(db: ReturnType<typeof getDb>, slug: string) {
  const row = db
    .select()
    .from(t.companyPortalAccess)
    .where(eq(t.companyPortalAccess.slug, slug))
    .get();
  if (!row) throw new ApiError(404, "Portal not found");
  if (!row.isActive) throw new ApiError(403, "Portal inactive");
  return row;
}

function upsertSessionRecord(db: ReturnType<typeof getDb>, session: ChatSession) {
  const existing = db.select().from(t.chatSessions).where(eq(t.chatSessions.id, session.id)).get();
  const values = {
    id: session.id,
    companyId: session.companyId ?? null,
    portalSlug: session.portalSlug ?? null,
    visitorName: session.visitorName,
    status: session.status,
    assignedAgentId: session.assignedAgentId ?? null,
    assignedAgentName: session.assignedAgentName ?? null,
    linkedTicketId: session.linkedTicketId ?? null,
    botAttempts: session.botAttempts,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  if (existing) {
    db.update(t.chatSessions).set(values).where(eq(t.chatSessions.id, session.id)).run();
  } else {
    db.insert(t.chatSessions).values(values).run();
  }

  db.delete(t.chatMessages).where(eq(t.chatMessages.sessionId, session.id)).run();
  for (const msg of session.messages) {
    db.insert(t.chatMessages)
      .values({
        id: msg.id,
        sessionId: session.id,
        senderType: msg.senderType,
        senderName: msg.senderName,
        text: msg.text,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      })
      .run();
  }
}

/* ---------- Admin (authenticated) ---------- */

export const listChatSessions = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  return loadAllSessions(db);
});

export const syncChatSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sessionSchema.parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    upsertSessionRecord(db, data);
    return loadSession(db, data.id)!;
  });

/* ---------- Portal (public, slug-scoped) ---------- */

export const getPortalChatSession = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1), visitorName: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    resolveActivePortal(db, data.slug);

    const row = db
      .select()
      .from(t.chatSessions)
      .where(
        and(
          eq(t.chatSessions.portalSlug, data.slug),
          eq(t.chatSessions.visitorName, data.visitorName),
          ne(t.chatSessions.status, "closed"),
        ),
      )
      .orderBy(desc(t.chatSessions.updatedAt))
      .limit(1)
      .all()[0];

    if (!row) return null;
    return loadSession(db, row.id);
  });

export const createPortalChatSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        visitorName: z.string().min(1),
        sessionId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);

    const existing = db
      .select()
      .from(t.chatSessions)
      .where(
        and(
          eq(t.chatSessions.portalSlug, data.slug),
          eq(t.chatSessions.visitorName, data.visitorName),
          ne(t.chatSessions.status, "closed"),
        ),
      )
      .get();
    if (existing) return loadSession(db, existing.id)!;

    const now = nowIso();
    const id = data.sessionId ?? newId();
    const greeting: ChatMessage = {
      id: newId(),
      sessionId: id,
      senderType: "bot",
      senderName: "Buildesk Assistant",
      text: CHATBOT_GREETING,
      createdAt: now,
      isRead: false,
    };

    const session: ChatSession = {
      id,
      companyId: portal.companyId,
      portalSlug: data.slug,
      visitorName: data.visitorName,
      status: "bot-handling",
      createdAt: now,
      updatedAt: now,
      messages: [greeting],
      botAttempts: 0,
    };

    upsertSessionRecord(db, session);
    return loadSession(db, id)!;
  });

export const syncPortalChatSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1), session: sessionSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    resolveActivePortal(db, data.slug);

    const row = db
      .select()
      .from(t.chatSessions)
      .where(eq(t.chatSessions.id, data.session.id))
      .get();
    if (!row || row.portalSlug !== data.slug) {
      throw new ApiError(404, "Chat session not found");
    }

    upsertSessionRecord(db, data.session);
    return loadSession(db, data.session.id)!;
  });
