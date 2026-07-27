import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationRule,
} from "@/types/automation";
import { nowIso } from "@/types";

export const DEFAULT_WHATSAPP_WEBHOOK = "http://72.60.200.185:5678/webhook/buildesk-whatsapp";
export const DEFAULT_EMAIL_WEBHOOK = "http://72.60.200.185:5678/webhook/buildesk-email";
export const DEFAULT_HEALTH_WEBHOOK = "http://72.60.200.185:5678/webhook/buildesk-health";

export const DEFAULT_AUTOMATION_ENDPOINTS: AutomationEndpoint[] = [
  {
    channel: "email",
    label: "Email (n8n)",
    webhookUrl: DEFAULT_EMAIL_WEBHOOK,
    isEnabled: true,
  },
  {
    channel: "whatsapp",
    label: "WhatsApp (n8n)",
    webhookUrl: DEFAULT_WHATSAPP_WEBHOOK,
    isEnabled: true,
  },
];

export const DEFAULT_HEALTH_CONFIG: AutomationHealthConfig = {
  label: "Health Check (n8n)",
  webhookUrl: DEFAULT_HEALTH_WEBHOOK,
  httpMethod: "POST",
};

function rule(
  partial: Omit<AutomationRule, "createdAt" | "updatedAt"> & { isActive: boolean },
): AutomationRule {
  const now = nowIso();
  return { ...partial, createdAt: now, updatedAt: now };
}

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  rule({
    id: "rule-ticket-created-email",
    name: "Ticket Created — Email",
    trigger: "ticket-created",
    channel: "email",
    isActive: true,
    templateSubject: "New support ticket {{ticketNumber}} — {{companyName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour support ticket {{ticketNumber}} has been created.\n\nSubject: {{title}}\nStatus: {{status}}\n\nView details: {{ticketUrl}}",
  }),
  rule({
    id: "rule-ticket-closed-email",
    name: "Ticket Closed — Email",
    trigger: "ticket-closed",
    channel: "email",
    isActive: true,
    templateSubject: "Ticket {{ticketNumber}} closed — {{companyName}}",
    templateBody:
      "Hi {{customerName}},\n\nYour ticket {{ticketNumber}} is now closed.\n\nSubject: {{title}}\nStatus: {{status}}\n\nThank you for working with us.",
  }),
  rule({
    id: "rule-ticket-created-whatsapp",
    name: "Ticket Created — WhatsApp",
    trigger: "ticket-created",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, ticket {{ticketNumber}} was created for {{companyName}}. Status: {{status}}. {{ticketUrl}}",
  }),
  rule({
    id: "rule-ticket-closed-whatsapp",
    name: "Ticket Closed — WhatsApp",
    trigger: "ticket-closed",
    channel: "whatsapp",
    isActive: false,
    templateBody:
      "Hi {{customerName}}, ticket {{ticketNumber}} for {{companyName}} is now closed. Status: {{status}}.",
  }),
];
