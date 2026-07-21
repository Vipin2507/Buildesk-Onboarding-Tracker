import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type {
  DesignTicket,
  DesignTicketAttachment,
  DesignTicketMessage,
  DesignTicketPriority,
  DesignTicketStatus,
} from "@/types/design-ticket";

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

function parseAttachments(json: string | null | undefined): DesignTicketAttachment[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as DesignTicketAttachment[];
    return parsed.length ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function serializeAttachments(attachments?: DesignTicketAttachment[]) {
  return attachments?.length ? JSON.stringify(attachments) : null;
}

function mapMessage(row: typeof t.designTicketMessages.$inferSelect): DesignTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    kind: row.kind as DesignTicketMessage["kind"],
    authorType: row.authorType as DesignTicketMessage["authorType"],
    authorName: row.authorName,
    message: row.message,
    attachments: parseAttachments(row.attachmentsJson),
    createdAt: row.createdAt,
  };
}

function mapTicket(
  row: typeof t.designTickets.$inferSelect,
  messages: typeof t.designTicketMessages.$inferSelect[],
): DesignTicket {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    companyId: row.companyId,
    subject: row.subject,
    description: row.description,
    category: row.category ?? undefined,
    priority: row.priority as DesignTicketPriority,
    status: row.status as DesignTicketStatus,
    assigneeId: row.assigneeId ?? undefined,
    createdBy: {
      type: row.createdByType as "client" | "team",
      name: row.createdByName,
    },
    resolvedAt: row.resolvedAt ?? undefined,
    messages: messages.map(mapMessage),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function loadTicket(db: ReturnType<typeof getDb>, ticketId: string): DesignTicket | null {
  const row = db.select().from(t.designTickets).where(eq(t.designTickets.id, ticketId)).get();
  if (!row) return null;
  const messages = db
    .select()
    .from(t.designTicketMessages)
    .where(eq(t.designTicketMessages.ticketId, ticketId))
    .orderBy(asc(t.designTicketMessages.createdAt))
    .all();
  return mapTicket(row, messages);
}

function loadTickets(db: ReturnType<typeof getDb>, companyId?: string): DesignTicket[] {
  const rows = companyId
    ? db
        .select()
        .from(t.designTickets)
        .where(eq(t.designTickets.companyId, companyId))
        .orderBy(desc(t.designTickets.updatedAt))
        .all()
    : db.select().from(t.designTickets).orderBy(desc(t.designTickets.updatedAt)).all();

  if (rows.length === 0) return [];

  const ticketIds = rows.map((r) => r.id);
  const allMessages = db
    .select()
    .from(t.designTicketMessages)
    .orderBy(asc(t.designTicketMessages.createdAt))
    .all()
    .filter((m) => ticketIds.includes(m.ticketId));

  const byTicket = new Map<string, typeof t.designTicketMessages.$inferSelect[]>();
  for (const msg of allMessages) {
    const list = byTicket.get(msg.ticketId) ?? [];
    list.push(msg);
    byTicket.set(msg.ticketId, list);
  }

  return rows.map((row) => mapTicket(row, byTicket.get(row.id) ?? []));
}

function nextDesignTicketNumber(db: ReturnType<typeof getDb>) {
  const rows = db.select({ ticketNumber: t.designTickets.ticketNumber }).from(t.designTickets).all();
  let max = 0;
  for (const row of rows) {
    const match = /^DT-(\d+)$/.exec(row.ticketNumber);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `DT-${String(max + 1).padStart(3, "0")}`;
}

function statusLabel(status: DesignTicketStatus) {
  return status === "in-progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
}

function insertSystemMessage(
  db: ReturnType<typeof getDb>,
  ticketId: string,
  text: string,
) {
  const msg = {
    id: newId(),
    ticketId,
    kind: "system",
    authorType: "system",
    authorName: "System",
    message: text,
    attachmentsJson: null,
    createdAt: nowIso(),
  };
  db.insert(t.designTicketMessages).values(msg).run();
  return msg;
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

function assertPortalTicket(
  db: ReturnType<typeof getDb>,
  slug: string,
  ticketId: string,
) {
  const portal = resolveActivePortal(db, slug);
  const ticket = db.select().from(t.designTickets).where(eq(t.designTickets.id, ticketId)).get();
  if (!ticket || ticket.companyId !== portal.companyId) {
    throw new ApiError(404, "Ticket not found");
  }
  return { portal, ticket };
}

const createInputSchema = z.object({
  id: z.string().optional(),
  companyId: z.string(),
  subject: z.string().min(1),
  description: z.string(),
  category: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  createdBy: z.object({
    type: z.enum(["client", "team"]),
    name: z.string(),
  }),
  attachments: z.array(attachmentSchema).optional(),
});

/* ---------- Admin (authenticated) ---------- */

export const listDesignTickets = createServerFn({ method: "GET" })
  .validator(z.object({ companyId: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    return loadTickets(db, data?.companyId);
  });

export const getDesignTicket = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const ticket = loadTicket(db, data.id);
    if (!ticket) throw new ApiError(404, "Ticket not found");
    return ticket;
  });

export const createDesignTicket = createServerFn({ method: "POST" })
  .validator(createInputSchema)
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const now = nowIso();
    const id = data.id ?? newId();
    const ticketNumber = nextDesignTicketNumber(db);

    db.insert(t.designTickets)
      .values({
        id,
        ticketNumber,
        companyId: data.companyId,
        subject: data.subject.trim(),
        description: data.description.trim(),
        category: data.category ?? null,
        priority: data.priority ?? "medium",
        status: "open",
        assigneeId: null,
        createdByType: data.createdBy.type,
        createdByName: data.createdBy.name,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (data.description.trim()) {
      db.insert(t.designTicketMessages)
        .values({
          id: newId(),
          ticketId: id,
          kind: "message",
          authorType: data.createdBy.type,
          authorName: data.createdBy.name,
          message: data.description.trim(),
          attachmentsJson: serializeAttachments(data.attachments),
          createdAt: now,
        })
        .run();
    }

    return loadTicket(db, id)!;
  });

export const addDesignTicketMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.string(),
      authorType: z.enum(["client", "team"]),
      authorName: z.string(),
      message: z.string().min(1),
      attachments: z.array(attachmentSchema).optional(),
    }),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const ticket = db.select().from(t.designTickets).where(eq(t.designTickets.id, data.ticketId)).get();
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const now = nowIso();
    db.insert(t.designTicketMessages)
      .values({
        id: newId(),
        ticketId: data.ticketId,
        kind: "message",
        authorType: data.authorType,
        authorName: data.authorName,
        message: data.message.trim(),
        attachmentsJson: serializeAttachments(data.attachments),
        createdAt: now,
      })
      .run();
    db.update(t.designTickets)
      .set({ updatedAt: now })
      .where(eq(t.designTickets.id, data.ticketId))
      .run();

    return loadTicket(db, data.ticketId)!;
  });

export const updateDesignTicketStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.string(),
      status: z.enum(["open", "in-progress", "resolved", "closed"]),
      actorName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const ticket = db.select().from(t.designTickets).where(eq(t.designTickets.id, data.ticketId)).get();
    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (ticket.status === data.status) return loadTicket(db, data.ticketId)!;

    const now = nowIso();
    const resolvedAt =
      data.status === "resolved" || data.status === "closed"
        ? ticket.resolvedAt ?? now
        : null;

    insertSystemMessage(
      db,
      data.ticketId,
      `Status changed to ${statusLabel(data.status)} by ${data.actorName}`,
    );
    db.update(t.designTickets)
      .set({
        status: data.status,
        resolvedAt,
        updatedAt: now,
      })
      .where(eq(t.designTickets.id, data.ticketId))
      .run();

    return loadTicket(db, data.ticketId)!;
  });

export const updateDesignTicketPriority = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      actorName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const ticket = db.select().from(t.designTickets).where(eq(t.designTickets.id, data.ticketId)).get();
    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (ticket.priority === data.priority) return loadTicket(db, data.ticketId)!;

    const now = nowIso();
    insertSystemMessage(
      db,
      data.ticketId,
      `Priority changed to ${data.priority.charAt(0).toUpperCase() + data.priority.slice(1)} by ${data.actorName}`,
    );
    db.update(t.designTickets)
      .set({ priority: data.priority, updatedAt: now })
      .where(eq(t.designTickets.id, data.ticketId))
      .run();

    return loadTicket(db, data.ticketId)!;
  });

export const assignDesignTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.string(),
      assigneeId: z.string().optional(),
      assigneeName: z.string(),
      actorName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const ticket = db.select().from(t.designTickets).where(eq(t.designTickets.id, data.ticketId)).get();
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const now = nowIso();
    const label = data.assigneeId ? data.assigneeName : "Unassigned";
    insertSystemMessage(db, data.ticketId, `Assignee set to ${label} by ${data.actorName}`);
    db.update(t.designTickets)
      .set({
        assigneeId: data.assigneeId ?? null,
        updatedAt: now,
      })
      .where(eq(t.designTickets.id, data.ticketId))
      .run();

    return loadTicket(db, data.ticketId)!;
  });

export const deleteDesignTicket = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    db.delete(t.designTicketMessages)
      .where(eq(t.designTicketMessages.ticketId, data.id))
      .run();
    db.delete(t.designTickets).where(eq(t.designTickets.id, data.id)).run();
    return { ok: true };
  });

/* ---------- Portal (public, slug-scoped) ---------- */

export const listPortalDesignTickets = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    return loadTickets(db, portal.companyId);
  });

export const getPortalDesignTicket = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1), ticketId: z.string() }))
  .handler(async ({ data }) => {
    const db = getDb();
    assertPortalTicket(db, data.slug, data.ticketId);
    const ticket = loadTicket(db, data.ticketId);
    if (!ticket) throw new ApiError(404, "Ticket not found");
    return ticket;
  });

export const createPortalDesignTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      subject: z.string().min(1),
      description: z.string().min(1),
      category: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      authorName: z.string().min(1),
      attachments: z.array(attachmentSchema).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    const now = nowIso();
    const id = newId();
    const ticketNumber = nextDesignTicketNumber(db);

    db.insert(t.designTickets)
      .values({
        id,
        ticketNumber,
        companyId: portal.companyId,
        subject: data.subject.trim(),
        description: data.description.trim(),
        category: data.category ?? null,
        priority: data.priority ?? "medium",
        status: "open",
        assigneeId: null,
        createdByType: "client",
        createdByName: data.authorName,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(t.designTicketMessages)
      .values({
        id: newId(),
        ticketId: id,
        kind: "message",
        authorType: "client",
        authorName: data.authorName,
        message: data.description.trim(),
        attachmentsJson: serializeAttachments(data.attachments),
        createdAt: now,
      })
      .run();

    return loadTicket(db, id)!;
  });

export const addPortalDesignTicketMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      ticketId: z.string(),
      authorName: z.string().min(1),
      message: z.string().min(1),
      attachments: z.array(attachmentSchema).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    assertPortalTicket(db, data.slug, data.ticketId);

    const now = nowIso();
    db.insert(t.designTicketMessages)
      .values({
        id: newId(),
        ticketId: data.ticketId,
        kind: "message",
        authorType: "client",
        authorName: data.authorName,
        message: data.message.trim(),
        attachmentsJson: serializeAttachments(data.attachments),
        createdAt: now,
      })
      .run();
    db.update(t.designTickets)
      .set({ updatedAt: now })
      .where(eq(t.designTickets.id, data.ticketId))
      .run();

    return loadTicket(db, data.ticketId)!;
  });
