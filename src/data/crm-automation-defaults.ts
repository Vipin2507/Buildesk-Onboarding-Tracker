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
    name: "Booking request — Executive email",
    description: "Notify the host executive when a portal client requests a call",
    trigger: "booking-created",
    channel: "email",
    isActive: true,
    templateSubject: "New booking request — {{eventTypeTitle}} · {{accountName}}",
    templateBody:
      "Hi {{hostName}},\n\n{{guestName}} requested a {{eventTypeTitle}} for {{accountName}}.\n\nWhen: {{startsAt}} – {{endsAt}}\nGuest: {{guestName}} ({{guestEmail}})\nStatus: {{status}}\n\nReview in CRM Bookings: {{bookingUrl}}",
  }),
  rule({
    id: "crm-rule-booking-status-email",
    name: "Booking status — Customer email",
    description: "Notify the guest when a booking is approved, cancelled, or postponed",
    trigger: "booking-status-changed",
    channel: "email",
    isActive: true,
    templateSubject: "Your call is {{status}} — {{eventTypeTitle}}",
    templateBody:
      "Hi {{guestName}},\n\nYour {{eventTypeTitle}} with {{hostName}} is now {{status}}.\n\nWhen: {{startsAt}} – {{endsAt}}\nAccount: {{accountName}}\n\nIf you need another time, open your portal and book again.",
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
  bookingUrl: "https://track.example.com/crm/bookings",
};
