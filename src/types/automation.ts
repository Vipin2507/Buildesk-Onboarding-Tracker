import type { TicketStatus } from "./ticket";

export type AutomationChannel = "email" | "whatsapp";

export type AutomationProvider = "n8n-webhook" | "waha";

export interface AutomationEndpoint {
  channel: AutomationChannel;
  label: string;
  provider: AutomationProvider;
  /** Used when provider is n8n-webhook (email). */
  webhookUrl: string;
  isEnabled: boolean;
  lastHealthCheck?: {
    status: "healthy" | "unhealthy" | "unknown";
    checkedAt: string;
    latencyMs?: number;
    message?: string;
  };
}

export interface WahaConfig {
  apiUrl: string;
  apiKey: string;
  sessionName: string;
  isEnabled: boolean;
  lastHealthCheck?: {
    status: "healthy" | "unhealthy" | "unknown";
    checkedAt: string;
    latencyMs?: number;
    message?: string;
    rawResponse?: string;
  };
}

export type AutomationTrigger =
  | "ticket-created"
  | "ticket-updated"
  | "ticket-closed"
  | "ticket-reply-from-team"
  | "booking-created"
  | "booking-status-changed";

export interface AutomationRule {
  id: string;
  name: string;
  /** Short internal note (optional). */
  description?: string;
  trigger: AutomationTrigger;
  channel: AutomationChannel;
  isActive: boolean;
  templateSubject?: string;
  templateBody: string;
  /** Rule-level CC merged with global settings CC for email sends. */
  emailCc?: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationLogStatus = "success" | "failed" | "retrying";

export interface AutomationLog {
  id: string;
  ticketId?: string;
  ticketNumber?: string;
  companyId?: string;
  channel: AutomationChannel;
  trigger: AutomationTrigger;
  status: AutomationLogStatus;
  requestPayload: Record<string, unknown>;
  responseSummary?: string;
  errorMessage?: string;
  attemptedAt: string;
  retryCount: number;
}

export type AutomationHealthMethod = "GET" | "POST";

export interface AutomationSettings {
  /** e.g. http://host:5678/webhook — segments appended (buildesk-email, buildesk-health). */
  n8nWebhookBase: string;
  automationsEnabled: boolean;
  emailCc?: string;
  emailFromAddress?: string;
  emailFromName?: string;
}

export interface AutomationHealthConfig {
  label: string;
  webhookUrl: string;
  httpMethod: AutomationHealthMethod;
  lastHealthCheck?: {
    status: "healthy" | "unhealthy" | "unknown";
    checkedAt: string;
    latencyMs?: number;
    message?: string;
    rawResponse?: string;
  };
}

export type AutomationPayload = {
  channel: AutomationChannel;
  trigger: AutomationTrigger;
  ticketNumber: string;
  companyName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  status: string;
  message: string;
  ticketUrl?: string;
  /** Set when sent from Automation → Test (not a real ticket event). */
  test?: boolean;
  /** Booking fields (optional). */
  bookingId?: string;
  bookingUrl?: string;
  eventTypeTitle?: string;
  startsAt?: string;
  endsAt?: string;
  previousStatus?: string;
  hostName?: string;
  hostEmail?: string;
  guestName?: string;
  guestEmail?: string;
};

export const AUTOMATION_TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: "ticket-created", label: "Ticket created" },
  { value: "ticket-updated", label: "Ticket updated" },
  { value: "ticket-closed", label: "Ticket closed" },
  { value: "ticket-reply-from-team", label: "Team reply on ticket" },
  { value: "booking-created", label: "Booking request (executive)" },
  { value: "booking-status-changed", label: "Booking status (customer)" },
];

export const AUTOMATION_TEMPLATE_VARS = [
  "{{customerName}}",
  "{{ticketNumber}}",
  "{{companyName}}",
  "{{accountName}}",
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
