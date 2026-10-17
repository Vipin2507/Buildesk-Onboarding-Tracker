import { renderAutomationTemplate } from "@/services/automationTemplate";
import type { CrmTicketReplyTemplateDef } from "@/types/crm-master";
import type { DesignTicket } from "@/types/design-ticket";

export const CRM_TICKET_REPLY_TEMPLATE_VARIABLES = [
  { key: "clientName", label: "Client / contact name" },
  { key: "companyName", label: "Company name" },
  { key: "ticketNumber", label: "Ticket number" },
  { key: "subject", label: "Ticket subject" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
] as const;

export function seedCrmTicketReplyTemplates(): CrmTicketReplyTemplateDef[] {
  return [
    {
      id: "ticket-tpl-ack",
      name: "Acknowledgment",
      category: "Intake",
      body: [
        "Hi {{clientName}},",
        "",
        "Thank you for raising {{ticketNumber}} — {{subject}}.",
        "",
        "We understand the importance of this request and our team is reviewing the details. We’ll update you here as soon as we have next steps.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 1,
    },
    {
      id: "ticket-tpl-in-progress",
      name: "In progress",
      category: "Update",
      body: [
        "Hi {{clientName}},",
        "",
        "A quick update on {{ticketNumber}}: this is currently in progress on our side.",
        "",
        "We’ll share another update here once we have a concrete outcome or if we need anything further from you.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 2,
    },
    {
      id: "ticket-tpl-need-info",
      name: "Need more information",
      category: "Update",
      body: [
        "Hi {{clientName}},",
        "",
        "Thanks for your patience on {{ticketNumber}}.",
        "",
        "To move forward, could you please share a bit more detail (screenshots, expected vs actual behaviour, or steps to reproduce)? That will help us resolve this faster.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 3,
    },
    {
      id: "ticket-tpl-eta",
      name: "ETA update",
      category: "Update",
      body: [
        "Hi {{clientName}},",
        "",
        "Sharing an ETA update for {{ticketNumber}} — {{subject}}.",
        "",
        "We’re targeting a fix/update shortly and will confirm here once it’s live on your side. Thank you for your understanding.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 4,
    },
    {
      id: "ticket-tpl-resolved",
      name: "Resolved",
      category: "Closure",
      body: [
        "Hi {{clientName}},",
        "",
        "Good news — {{ticketNumber}} ({{subject}}) has been resolved.",
        "",
        "Please verify on your side and reply here if anything still looks off. We’re happy to help further.",
        "",
        "Best regards,",
      ].join("\n"),
      active: true,
      order: 5,
    },
  ];
}

function slugifyTemplateId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Normalize Master ticket reply templates; missing/invalid → seed defaults. */
export function normalizeCrmTicketReplyTemplates(
  existing: CrmTicketReplyTemplateDef[] | undefined | null,
): CrmTicketReplyTemplateDef[] {
  if (!Array.isArray(existing)) return seedCrmTicketReplyTemplates();

  const seen = new Set<string>();
  const out: CrmTicketReplyTemplateDef[] = [];

  for (const [i, row] of existing.entries()) {
    const name = String(row?.name ?? "").trim();
    const body = String(row?.body ?? "").trim();
    if (!name || !body) continue;

    let id = String(row?.id ?? "").trim() || slugifyTemplateId(name);
    id = slugifyTemplateId(id) || `ticket-tpl-${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);

    out.push({
      id,
      name,
      category: String(row?.category ?? "").trim() || "General",
      body,
      active: row?.active !== false,
      order: typeof row?.order === "number" && Number.isFinite(row.order) ? row.order : i + 1,
    });
  }

  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export type CrmTicketReplyTemplateContext = {
  ticket: Pick<
    DesignTicket,
    "ticketNumber" | "subject" | "category" | "status" | "priority" | "createdBy"
  >;
  companyName?: string;
  clientName?: string;
};

/** Build `{{variable}}` map from a design ticket (+ optional company). */
export function buildCrmTicketReplyTemplateVars(
  ctx: CrmTicketReplyTemplateContext | undefined | null,
): Record<string, string> {
  if (!ctx?.ticket) {
    return {
      clientName: "there",
      companyName: "",
      ticketNumber: "",
      subject: "",
      category: "",
      status: "",
      priority: "",
    };
  }
  const { ticket } = ctx;
  const clientName =
    ctx.clientName?.trim() ||
    (ticket.createdBy.type === "client" ? ticket.createdBy.name.trim() : "") ||
    "there";
  return {
    clientName,
    companyName: ctx.companyName?.trim() || "",
    ticketNumber: ticket.ticketNumber?.trim() || "",
    subject: ticket.subject?.trim() || "",
    category: ticket.category?.trim() || "",
    status: ticket.status?.trim() || "",
    priority: ticket.priority?.trim() || "",
  };
}

export function applyCrmTicketReplyTemplate(
  body: string,
  ctx: CrmTicketReplyTemplateContext | undefined | null,
): string {
  return renderAutomationTemplate(body, buildCrmTicketReplyTemplateVars(ctx));
}

/** List `{{var}}` keys referenced in a template body. */
export function listCrmTicketReplyTemplateVarsInBody(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}
