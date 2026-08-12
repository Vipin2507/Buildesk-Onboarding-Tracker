import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationRule,
  AutomationSettings,
} from "@/types/automation";
import { nowIso } from "@/types";

/** CRM-dedicated n8n segments — separate from ERP buildesk-email / buildesk-health. */
export const DEFAULT_CRM_N8N_WEBHOOK_BASE = "http://72.60.200.185:5678/webhook";
export const CRM_N8N_EMAIL_SEGMENT = "buildesk-crm-email";
export const CRM_N8N_HEALTH_SEGMENT = "buildesk-crm-health";

export const DEFAULT_CRM_EMAIL_WEBHOOK = `${DEFAULT_CRM_N8N_WEBHOOK_BASE}/${CRM_N8N_EMAIL_SEGMENT}`;
export const DEFAULT_CRM_HEALTH_WEBHOOK = `${DEFAULT_CRM_N8N_WEBHOOK_BASE}/${CRM_N8N_HEALTH_SEGMENT}`;

export const DEFAULT_CRM_WAHA_API_URL = "http://72.60.200.185:3000";
export const DEFAULT_CRM_WAHA_API_KEY = "MySecretWAHAKey";
export const DEFAULT_CRM_WAHA_SESSION = "crm";

export const DEFAULT_CRM_WAHA_CONFIG = {
  apiUrl: DEFAULT_CRM_WAHA_API_URL,
  apiKey: DEFAULT_CRM_WAHA_API_KEY,
  sessionName: DEFAULT_CRM_WAHA_SESSION,
  isEnabled: true,
};

export const DEFAULT_CRM_AUTOMATION_SETTINGS: AutomationSettings = {
  n8nWebhookBase: DEFAULT_CRM_N8N_WEBHOOK_BASE,
  automationsEnabled: true,
};

export const DEFAULT_CRM_AUTOMATION_ENDPOINTS: AutomationEndpoint[] = [
  {
    channel: "email",
    label: "CRM Email (n8n)",
    provider: "n8n-webhook",
    webhookUrl: DEFAULT_CRM_EMAIL_WEBHOOK,
    isEnabled: true,
  },
  {
    channel: "whatsapp",
    label: "CRM WhatsApp (WAHA)",
    provider: "waha",
    webhookUrl: DEFAULT_CRM_WAHA_API_URL,
    isEnabled: true,
  },
];

export const DEFAULT_CRM_HEALTH_CONFIG: AutomationHealthConfig = {
  label: "CRM Health Check (n8n)",
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
};
