import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationRule,
  AutomationSettings,
} from "@/types/automation";
import { nowIso } from "@/types";
import {
  DEFAULT_EMAIL_WEBHOOK,
  DEFAULT_HEALTH_WEBHOOK,
  DEFAULT_N8N_WEBHOOK_BASE,
  DEFAULT_WAHA_API_KEY,
  DEFAULT_WAHA_API_URL,
  DEFAULT_WAHA_SESSION,
  N8N_EMAIL_SEGMENT,
  N8N_HEALTH_SEGMENT,
} from "@/data/automationDefaults";

/** Shared with ERP — same n8n email + health nodes. */
export { N8N_EMAIL_SEGMENT, N8N_HEALTH_SEGMENT, DEFAULT_N8N_WEBHOOK_BASE };

export const DEFAULT_CRM_EMAIL_WEBHOOK = DEFAULT_EMAIL_WEBHOOK;
export const DEFAULT_CRM_HEALTH_WEBHOOK = DEFAULT_HEALTH_WEBHOOK;

export const DEFAULT_CRM_WAHA_API_URL = DEFAULT_WAHA_API_URL;
export const DEFAULT_CRM_WAHA_API_KEY = DEFAULT_WAHA_API_KEY;
/** WAHA session can stay shared; CRM vs ERP is distinguished in rules/logs. */
export const DEFAULT_CRM_WAHA_SESSION = DEFAULT_WAHA_SESSION;

export const DEFAULT_CRM_WAHA_CONFIG = {
  apiUrl: DEFAULT_CRM_WAHA_API_URL,
  apiKey: DEFAULT_CRM_WAHA_API_KEY,
  sessionName: DEFAULT_CRM_WAHA_SESSION,
  isEnabled: true,
};

export const DEFAULT_CRM_AUTOMATION_SETTINGS: AutomationSettings = {
  n8nWebhookBase: DEFAULT_N8N_WEBHOOK_BASE,
  automationsEnabled: true,
};

export const DEFAULT_CRM_AUTOMATION_ENDPOINTS: AutomationEndpoint[] = [
  {
    channel: "email",
    label: "Email (n8n)",
    provider: "n8n-webhook",
    webhookUrl: DEFAULT_CRM_EMAIL_WEBHOOK,
    isEnabled: true,
  },
  {
    channel: "whatsapp",
    label: "WhatsApp (WAHA)",
    provider: "waha",
    webhookUrl: DEFAULT_CRM_WAHA_API_URL,
    isEnabled: true,
  },
];

/**
 * Merge seed endpoints onto saved ones.
 * Never reset channel toggles (isEnabled) or custom webhook URLs on deploy/seed sync.
 */
export function mergeCrmAutomationEndpoints(
  existing: AutomationEndpoint[],
  seeds: AutomationEndpoint[] = DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  opts?: { replaceLegacyUrls?: boolean },
): AutomationEndpoint[] {
  const byChannel = new Map(existing.map((e) => [e.channel, e]));
  return seeds.map((seed) => {
    const current = byChannel.get(seed.channel);
    if (!current) return { ...seed };
    const legacyUrl =
      opts?.replaceLegacyUrls &&
      (current.webhookUrl.includes("buildesk-crm-") || !current.webhookUrl?.trim());
    return {
      ...seed,
      ...current,
      label: current.label || seed.label,
      provider: current.provider || seed.provider,
      webhookUrl: legacyUrl || !current.webhookUrl?.trim() ? seed.webhookUrl : current.webhookUrl,
      isEnabled: current.isEnabled,
      lastHealthCheck: current.lastHealthCheck ?? seed.lastHealthCheck,
    };
  });
}

export const DEFAULT_CRM_HEALTH_CONFIG: AutomationHealthConfig = {
  label: "Health Check (n8n)",
  webhookUrl: DEFAULT_CRM_HEALTH_WEBHOOK,
  httpMethod: "POST",
};

function rule(
  partial: Omit<AutomationRule, "createdAt" | "updatedAt"> & { isActive: boolean },
): AutomationRule {
  const now = nowIso();
  return { ...partial, createdAt: now, updatedAt: now };
}

export const CRM_BOOKING_AUTOMATION_TRIGGERS = ["booking-created", "booking-status-changed"] as const;

export const CRM_TASK_AUTOMATION_TRIGGERS = ["task-before-start"] as const;

export const CRM_PAYMENT_AUTOMATION_TRIGGERS = [
  "payment-overdue",
  "payment-executive-remind",
] as const;

export const CRM_QUERY_AUTOMATION_TRIGGERS = ["query-response"] as const;

export const CRM_LIVE_CHAT_AUTOMATION_TRIGGERS = ["live-chat-started"] as const;

export const CRM_PORTAL_TICKET_AUTOMATION_TRIGGERS = ["portal-ticket-created"] as const;

export const DEFAULT_TASK_REMINDER_OFFSET_MINUTES = 15;

const CRM_AUTOMATION_SEED_SYNC_RULE_IDS = new Set([
  "crm-rule-payment-executive-email",
  "crm-rule-payment-executive-whatsapp",
  "crm-rule-query-response-email",
  "crm-rule-query-response-whatsapp",
]);

/** True when a saved rule still has pre-digest copy/templates and should pick up seed defaults. */
export function crmAutomationRuleNeedsSeedSync(
  existing: AutomationRule,
  seed: AutomationRule,
): boolean {
  if (!CRM_AUTOMATION_SEED_SYNC_RULE_IDS.has(seed.id)) return false;
  if (existing.id !== seed.id) return false;

  if (seed.id === "crm-rule-payment-executive-email") {
    if (existing.templateBody?.includes("{{digestBody}}")) return false;
    if (existing.description?.includes("overdue payments digest")) return false;
    if (existing.description?.includes("sales manager and support managers")) return true;
    if (existing.templateBody?.includes("Payment collection update")) return true;
    return existing.templateSubject !== seed.templateSubject || existing.templateBody !== seed.templateBody;
  }

  if (seed.id === "crm-rule-payment-executive-whatsapp") {
    if (existing.templateBody?.trim() === "{{digestBodyWhatsapp}}") return false;
    if (existing.templateBody?.trim() === "{{digestBody}}") return true;
    if (existing.templateBody?.includes("payment reminder ({{accountCount}}")) return true;
    return existing.templateBody !== seed.templateBody || existing.description !== seed.description;
  }

  if (seed.trigger === "query-response") {
    if (existing.description === seed.description && existing.templateBody === seed.templateBody) {
      return false;
    }
    if (!existing.description?.includes("replied on a query") && seed.description?.includes("replied on a query")) {
      return true;
    }
    // Keep WhatsApp/email bodies unique per send ({{sentAt}}) so follow-up mentions aren't dropped.
    if (seed.templateBody?.includes("{{sentAt}}") && !existing.templateBody?.includes("{{sentAt}}")) {
      return true;
    }
  }

  return (
    existing.name !== seed.name ||
    existing.description !== seed.description ||
    existing.templateSubject !== seed.templateSubject ||
    existing.templateBody !== seed.templateBody
  );
}

function applyCrmAutomationSeedSync(existing: AutomationRule, seed: AutomationRule): AutomationRule {
  if (!crmAutomationRuleNeedsSeedSync(existing, seed)) return existing;
  return {
    ...existing,
    name: seed.name,
    description: seed.description,
    templateSubject: seed.templateSubject,
    templateBody: seed.templateBody,
    // Operator toggle must survive deploys / seed template sync.
    isActive: existing.isActive,
    updatedAt: nowIso(),
  };
}

/** Merge seed rules by id so new automations appear on older saved configs; patch legacy payment/query templates. */
export function mergeCrmAutomationRules(existing: AutomationRule[]): AutomationRule[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const seed of DEFAULT_CRM_AUTOMATION_RULES) {
    const current = byId.get(seed.id);
    if (!current) {
      byId.set(seed.id, seed);
      continue;
    }
    byId.set(seed.id, applyCrmAutomationSeedSync(current, seed));
  }
  return [...byId.values()];
}

export function crmAutomationRulesDifferFromMerge(existing: AutomationRule[]): boolean {
  const merged = mergeCrmAutomationRules(existing);
  if (merged.length !== existing.length) return true;
  const byId = new Map(existing.map((r) => [r.id, r]));
  return merged.some((r) => {
    const prev = byId.get(r.id);
    if (!prev) return true;
    return (
      prev.name !== r.name ||
      prev.description !== r.description ||
      prev.templateSubject !== r.templateSubject ||
      prev.templateBody !== r.templateBody
    );
  });
}

/** Seed rules for CRM Support Desk tickets (account-scoped). */
export const DEFAULT_CRM_AUTOMATION_RULES: AutomationRule[] = [
  rule({
    id: "crm-rule-ticket-created-email",
    name: "CRM Ticket Created — Email",
    description: "Notify account contact when a CRM support ticket is opened",
    trigger: "ticket-created",
    channel: "email",
    isActive: true,
    templateSubject: "CRM support ticket {{ticketNumber}} — {{accountName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour CRM support ticket {{ticketNumber}} has been created for {{accountName}}.\n\nSubject: {{title}}\nStatus: {{status}}\nSales manager: {{salesManagerName}}\n\nView details: {{ticketUrl}}",
  }),
  rule({
    id: "crm-rule-ticket-closed-email",
    name: "CRM Ticket Closed — Email",
    description: "Notify account contact when a CRM ticket is closed or resolved",
    trigger: "ticket-closed",
    channel: "email",
    isActive: true,
    templateSubject: "CRM ticket {{ticketNumber}} closed — {{accountName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour CRM ticket {{ticketNumber}} for {{accountName}} is now closed.\n\nSubject: {{title}}\nStatus: {{status}}\n\nThank you.",
  }),
  rule({
    id: "crm-rule-ticket-updated-email",
    name: "CRM Ticket Updated — Email",
    description: "Notify on CRM ticket status changes (non-closed)",
    trigger: "ticket-updated",
    channel: "email",
    isActive: false,
    templateSubject: "CRM ticket {{ticketNumber}} updated — {{accountName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour CRM ticket {{ticketNumber}} for {{accountName}} was updated.\n\nSubject: {{title}}\nStatus: {{status}}\n\n{{ticketUrl}}",
  }),
  rule({
    id: "crm-rule-team-reply-email",
    name: "CRM Team Reply — Email",
    description: "Notify contact when the CRM team replies on a ticket",
    trigger: "ticket-reply-from-team",
    channel: "email",
    isActive: false,
    templateSubject: "Update on CRM ticket {{ticketNumber}} — {{accountName}}",
    templateBody:
      "Hi {{customerName}},\n\nThere is a new reply on CRM ticket {{ticketNumber}} ({{accountName}}).\n\nSubject: {{title}}\nStatus: {{status}}\n\n{{ticketUrl}}",
  }),
  rule({
    id: "crm-rule-ticket-created-whatsapp",
    name: "CRM Ticket Created — WhatsApp",
    trigger: "ticket-created",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, CRM ticket {{ticketNumber}} was created for {{accountName}}. Status: {{status}}. {{ticketUrl}}",
  }),
  rule({
    id: "crm-rule-ticket-closed-whatsapp",
    name: "CRM Ticket Closed — WhatsApp",
    trigger: "ticket-closed",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, CRM ticket {{ticketNumber}} for {{accountName}} is now closed. Status: {{status}}.",
  }),
  rule({
    id: "crm-rule-booking-created-email",
    name: "Meeting request — Executive email",
    description: "Notify the host executive when a portal client requests a call",
    trigger: "booking-created",
    channel: "email",
    isActive: true,
    templateSubject: "New meeting request — {{eventTypeTitle}} · {{accountName}}",
    templateBody:
      "Hi {{hostName}},\n\n{{guestName}} requested a {{eventTypeTitle}} for {{accountName}}.\n\nWhen: {{startsAt}} – {{endsAt}}\nGuest: {{guestName}} ({{guestEmail}})\nStatus: {{status}}\n\nApprove, reject, or postpone in CRM Meetings: {{bookingUrl}}",
  }),
  rule({
    id: "crm-rule-booking-created-whatsapp",
    name: "Meeting request — Executive WhatsApp",
    description:
      "WhatsApp the host and related CRM executives when a portal client books a call, with a link to approve, reject, or postpone",
    trigger: "booking-created",
    channel: "whatsapp",
    isActive: true,
    templateBody:
      "Hi {{recipientName}}, {{guestName}} booked a {{eventTypeTitle}} for {{accountName}}.\n\nWhen: {{startsAt}} – {{endsAt}}\nGuest: {{guestName}} ({{guestEmail}})\nStatus: {{status}}\n\nApprove / reject / postpone: {{bookingUrl}}",
  }),
  rule({
    id: "crm-rule-booking-status-email",
    name: "Meeting status — Customer email",
    description: "Notify the guest when a meeting is approved, cancelled, or postponed",
    trigger: "booking-status-changed",
    channel: "email",
    isActive: true,
    templateSubject: "Your call is {{status}} — {{eventTypeTitle}}",
    templateBody:
      "Hi {{guestName}},\n\nYour {{eventTypeTitle}} with {{hostName}} is now {{status}}.\n\nWhen: {{startsAt}} – {{endsAt}}\nAccount: {{accountName}}\n{{meetUrlLine}}\nIf you need another time, open your portal and book again.",
  }),
  rule({
    id: "crm-rule-task-before-email",
    name: "Task reminder — Executive email",
    description: "Email assignees before a scheduled CRM task starts",
    trigger: "task-before-start",
    channel: "email",
    isActive: true,
    offsetMinutes: DEFAULT_TASK_REMINDER_OFFSET_MINUTES,
    templateSubject: "Upcoming task in {{offsetMinutes}} min — {{taskTitle}}",
    templateBody:
      "Hi {{assigneeName}},\n\nReminder: you have a scheduled task starting at {{startsAt}}.\n\nTask: {{taskTitle}}\nAccount: {{accountName}}\nWhen: {{startsAt}} – {{endsAt}}\n\nOpen in CRM: {{taskUrl}}",
  }),
  rule({
    id: "crm-rule-task-before-whatsapp",
    name: "Task reminder — Executive WhatsApp",
    description: "WhatsApp assignees before a scheduled CRM task starts",
    trigger: "task-before-start",
    channel: "whatsapp",
    isActive: true,
    offsetMinutes: DEFAULT_TASK_REMINDER_OFFSET_MINUTES,
    templateBody:
      "Hi {{assigneeName}}, reminder: \"{{taskTitle}}\" for {{accountName}} starts at {{startsAt}} (in {{offsetMinutes}} min). {{taskUrl}}",
  }),
  rule({
    id: "crm-rule-payment-overdue-email",
    name: "Payment reminder — Client email",
    description: "Email the account contact when a payment reminder is sent from Payments",
    trigger: "payment-overdue",
    channel: "email",
    isActive: true,
    templateSubject: "Payment reminder — {{accountName}}",
    templateBody:
      "Hi {{customerName}},\n\nThis is a reminder that ₹{{dueAmount}} is due by {{dueDate}} for {{accountName}}.\n\nReceived so far: ₹{{paymentReceived}}\nPending: ₹{{pendingAmount}}\n\nPlease arrange payment at your earliest convenience.\n\nThank you.",
  }),
  rule({
    id: "crm-rule-payment-executive-email",
    name: "Payment reminder — Executive email",
    description:
      "Email executives and admins for a single-account payment reminder or the overdue payments digest from CRM Payments",
    trigger: "payment-executive-remind",
    channel: "email",
    isActive: true,
    templateSubject: "{{subject}}",
    templateBody:
      "{{digestBody}}",
  }),
  rule({
    id: "crm-rule-payment-executive-whatsapp",
    name: "Payment reminder — Executive WhatsApp",
    description:
      "WhatsApp executives and admins for a single-account payment reminder or the overdue payments digest from CRM Payments",
    trigger: "payment-executive-remind",
    channel: "whatsapp",
    isActive: true,
    templateBody: "{{digestBodyWhatsapp}}",
  }),
  rule({
    id: "crm-rule-query-response-whatsapp",
    name: "Account query reply — Executive WhatsApp",
    description:
      "WhatsApp @mentioned people when a query message has mentions; otherwise CRM admins and the account sales manager and support managers",
    trigger: "query-response",
    channel: "whatsapp",
    isActive: true,
    templateBody:
      "Hi {{recipientName}}, {{authorName}} replied on \"{{title}}\" ({{accountName}}) at {{sentAt}}:\n{{messageSnippet}}\n\nOpen in CRM: {{queryUrl}}",
  }),
  rule({
    id: "crm-rule-query-response-email",
    name: "Account query reply — Executive email",
    description:
      "Email CRM admins and the account sales manager and support managers when someone replies on a query",
    trigger: "query-response",
    channel: "email",
    isActive: false,
    templateSubject: "New reply on {{title}} — {{accountName}}",
    templateBody:
      "Hi {{recipientName}},\n\n{{authorName}} replied on the account query \"{{title}}\" for {{accountName}} at {{sentAt}}.\n\n{{messageSnippet}}\n\nOpen in CRM: {{queryUrl}}",
  }),
  rule({
    id: "crm-rule-live-chat-started-whatsapp",
    name: "Live chat started — Executive WhatsApp",
    description:
      "WhatsApp CRM admins and the account sales manager and support managers when a customer starts a live chat from the portal",
    trigger: "live-chat-started",
    channel: "whatsapp",
    isActive: true,
    templateBody:
      "Hi {{recipientName}}, {{visitorName}} started a live chat for {{accountName}}.\n\nOpen Live Chat: {{chatUrl}}",
  }),
  rule({
    id: "crm-rule-portal-ticket-created-whatsapp",
    name: "Portal ticket created — Executive WhatsApp",
    description:
      "WhatsApp CRM admins and the account sales manager and support managers when a client creates a ticket from the portal",
    trigger: "portal-ticket-created",
    channel: "whatsapp",
    isActive: true,
    templateBody:
      "Hi {{recipientName}}, {{authorName}} created portal ticket {{ticketNumber}} for {{accountName}}.\n\n{{title}}\nPriority: {{priority}}\n\nOpen in CRM: {{ticketUrl}}",
  }),
];

export const CRM_AUTOMATION_TEMPLATE_VARS = [
  "{{customerName}}",
  "{{ticketNumber}}",
  "{{accountName}}",
  "{{companyName}}",
  "{{salesManagerName}}",
  "{{status}}",
  "{{ticketUrl}}",
  "{{subject}}",
  "{{title}}",
  "{{guestName}}",
  "{{guestEmail}}",
  "{{hostName}}",
  "{{eventTypeTitle}}",
  "{{startsAt}}",
  "{{endsAt}}",
  "{{previousStatus}}",
  "{{bookingId}}",
  "{{bookingUrl}}",
  "{{meetUrl}}",
  "{{meetUrlLine}}",
  "{{taskId}}",
  "{{taskTitle}}",
  "{{taskUrl}}",
  "{{assigneeName}}",
  "{{offsetMinutes}}",
  "{{dueAmount}}",
  "{{dueDate}}",
  "{{paymentReceived}}",
  "{{pendingAmount}}",
  "{{totalDealValue}}",
  "{{overdueAmount}}",
  "{{overdueDays}}",
  "{{supportManager1}}",
  "{{supportManager2}}",
  "{{executiveName}}",
  "{{recipientName}}",
  "{{authorName}}",
  "{{priority}}",
  "{{accountCount}}",
  "{{digestDetails}}",
  "{{digestBody}}",
  "{{digestBodyWhatsapp}}",
  "{{totalOutstanding}}",
  "{{messageSnippet}}",
  "{{queryUrl}}",
  "{{visitorName}}",
  "{{chatUrl}}",
  "{{sessionId}}",
] as const;

export const CRM_AUTOMATION_SAMPLE_VARS: Record<string, string> = {
  customerName: "Amit Verma",
  ticketNumber: "TKT-2201",
  accountName: "Horizon Realty",
  companyName: "Horizon Realty",
  salesManagerName: "Priya Sales",
  status: "Open",
  ticketUrl: "https://track.example.com/crm/support/TKT-2201",
  subject: "Onboarding checklist stuck",
  title: "Onboarding checklist stuck",
  guestName: "Amit Verma",
  guestEmail: "amit@horizon.example",
  hostName: "Priya Sales",
  eventTypeTitle: "Query",
  startsAt: "2026-08-20 10:00",
  endsAt: "2026-08-20 10:15",
  previousStatus: "pending",
  bookingId: "bk-1001",
  bookingUrl: "https://track.example.com/crm/bookings?tab=pending&appointmentId=bk-1001",
  meetUrl: "https://meet.google.com/abc-defg-hij",
  meetUrlLine: "Google Meet: https://meet.google.com/abc-defg-hij\n",
  taskId: "task-9001",
  taskTitle: "GMeet onboarding walkthrough",
  taskUrl: "https://track.example.com/crm/tasks?task=task-9001",
  assigneeName: "Priya Sales",
  offsetMinutes: "15",
  dueAmount: "250000",
  dueDate: "2026-09-15",
  paymentReceived: "500000",
  pendingAmount: "750000",
  totalDealValue: "1250000",
  overdueAmount: "0",
  overdueDays: "0",
  supportManager1: "Anita Support",
  supportManager2: "Ravi Support",
  executiveName: "Priya Sales",
  accountCount: "2",
  digestDetails:
    "1. Horizon Realty\n🔴 Overdue: ₹2,50,000 (5 days)\n📅 Due: 10 Sept 2026\n💰 Pending: ₹7,50,000\n✅ Received: ₹5,00,000 / ₹12,50,000\n👤 Support: Anita Support, Ravi Support\n\n2. Skyline Developers\n🔴 Overdue: ₹1,20,000 (2 days)\n📅 Due: 12 Sept 2026\n💰 Pending: ₹3,50,000\n✅ Received: ₹5,00,000 / ₹8,50,000\n👤 Support: Anita Support",
  digestBody:
    "Hi Priya Sales,\n\n🔔 PAYMENT REMINDER — 2 ACCOUNTS\n\nPlease find below the accounts with overdue payments:\n\n…\n\n📌 TOTAL OUTSTANDING: ₹3,70,000\n\nRequest you to please review these accounts and ensure the necessary payment follow-up and closure.\n\n🔗 CRM → Payments",
  digestBodyWhatsapp:
    "Hi *Priya Sales*,\n\n*🔔 PAYMENT REMINDER — 2 ACCOUNTS*\n\n_Please find below the accounts with overdue payments:_\n\n…\n\n📌 *TOTAL OUTSTANDING: ₹3,70,000*\n\n_Request you to please review…_\n\n*🔗 CRM → Payments*",
  totalOutstanding: "370000",
  authorName: "Amit Verma",
  priority: "medium",
  messageSnippet: "Can we get an update on the onboarding checklist?",
  queryUrl: "https://track.example.com/crm/accounts/acme?tab=queries&queryId=q-1001",
  recipientName: "Priya Sales",
  visitorName: "Amit Verma",
  chatUrl: "https://track.example.com/crm/live-chat",
  sessionId: "CS-1001",
};
