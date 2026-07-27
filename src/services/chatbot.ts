import {
  CHATBOT_KNOWLEDGE,
  type ChatbotArticle,
} from "@/data/chatbotKnowledge";
import { DESIGN_TICKET_STATUS_LABEL } from "@/types/design-ticket";
import type { DesignTicket } from "@/types/design-ticket";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

export type ChatbotContext = {
  companyId?: string;
  visitorName?: string;
};

const GREETING_PATTERN =
  /^(hi|hello|hey|hiya|good\s*(morning|afternoon|evening)|namaste|howdy)[\s!.,?]*$/i;

const TICKET_NUMBER_PATTERN = /\bDT-?(\d+)\b/i;

const OPEN_TICKETS_QUERY =
  /my tickets?|open tickets?|pending tickets?|active tickets?|how many tickets?|list tickets?/i;

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreArticle(query: string, article: ChatbotArticle): number {
  const q = normalize(query);
  let score = 0;

  if (article.quickReplyLabel && normalize(article.quickReplyLabel) === q) {
    score += 20;
  }

  for (const kw of article.keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (q === k) score += 15;
    else if (q.includes(k)) score += k.length >= 10 ? 4 : k.length >= 6 ? 3 : 2;
  }

  return score > 0 ? score + article.priority : 0;
}

function findBestArticle(query: string): ChatbotArticle | null {
  let best: ChatbotArticle | null = null;
  let bestScore = 0;

  for (const article of CHATBOT_KNOWLEDGE) {
    const score = scoreArticle(query, article);
    if (score > bestScore) {
      bestScore = score;
      best = article;
    }
  }

  return bestScore >= 3 ? best : null;
}

function formatTicketLookup(ticket: DesignTicket): string {
  const status = DESIGN_TICKET_STATUS_LABEL[ticket.status];
  const lines = [
    `**${ticket.ticketNumber}** — ${ticket.subject}`,
    `Status: **${status}**`,
    `Priority: ${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`,
  ];
  if (ticket.category) lines.push(`Category: ${ticket.category}`);
  lines.push("\nOpen this ticket under **My Tickets** to view the full thread and reply.");
  return lines.join("\n");
}

function lookupTicketByNumber(text: string, companyId?: string): string | null {
  if (!companyId) return null;
  const match = TICKET_NUMBER_PATTERN.exec(text);
  if (!match) return null;

  const num = Number.parseInt(match[1], 10);
  const padded = `DT-${String(num).padStart(3, "0")}`;
  const raw = `DT-${num}`;

  const tickets = useDesignTicketStore
    .getState()
    .tickets.filter((t) => t.companyId === companyId);

  const ticket =
    tickets.find((t) => t.ticketNumber.toUpperCase() === padded.toUpperCase()) ??
    tickets.find((t) => t.ticketNumber.toUpperCase() === raw.toUpperCase());

  if (!ticket) {
    return `I couldn't find ticket **${padded}** for your company. Check the number under **My Tickets**, or create a new request from **Create New Ticket**.`;
  }

  return formatTicketLookup(ticket);
}

function summarizeOpenTickets(query: string, companyId?: string): string | null {
  if (!companyId || !OPEN_TICKETS_QUERY.test(query)) return null;

  const tickets = useDesignTicketStore
    .getState()
    .tickets.filter(
      (t) => t.companyId === companyId && (t.status === "open" || t.status === "in-progress"),
    );

  if (tickets.length === 0) {
    return "You have **no open tickets** right now. Use **Create New Ticket** to submit a new request.";
  }

  const preview = tickets
    .slice(0, 5)
    .map((t) => `• **${t.ticketNumber}** — ${t.subject} (${DESIGN_TICKET_STATUS_LABEL[t.status]})`)
    .join("\n");

  const more =
    tickets.length > 5 ? `\n\n…and ${tickets.length - 5} more. See all under **My Tickets**.` : "";

  return `You have **${tickets.length} open ticket${tickets.length === 1 ? "" : "s"}**:\n\n${preview}${more}`;
}

function greetingResponse(ctx?: ChatbotContext): string {
  const name = ctx?.visitorName?.split(" ")[0];
  if (name) {
    return `Hello ${name}! How can I help you today? You can ask about your tickets, creating a request, billing, or onboarding.`;
  }
  return "Hello! How can I help you today? You can ask about your tickets, creating a request, billing, or onboarding.";
}

export function getBotResponse(text: string, ctx?: ChatbotContext): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (GREETING_PATTERN.test(trimmed)) {
    return greetingResponse(ctx);
  }

  const ticketLookup = lookupTicketByNumber(trimmed, ctx?.companyId);
  if (ticketLookup) return ticketLookup;

  const openSummary = summarizeOpenTickets(trimmed, ctx?.companyId);
  if (openSummary) return openSummary;

  const article = findBestArticle(trimmed);
  if (!article) return null;
  if (article.escalate) return "__ESCALATE__";
  return article.response;
}

export function matchQuickReplyLabel(label: string): string | null {
  const article = CHATBOT_KNOWLEDGE.find((a) => a.quickReplyLabel === label);
  if (!article) return null;
  if (article.escalate) return "__ESCALATE__";
  return article.response;
}

/** Articles grouped by category (for admin/debug tooling) */
export function getKnowledgeByCategory() {
  const map = new Map<string, ChatbotArticle[]>();
  for (const article of CHATBOT_KNOWLEDGE) {
    const list = map.get(article.category) ?? [];
    list.push(article);
    map.set(article.category, list);
  }
  return map;
}
