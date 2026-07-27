import type { TicketStatus } from "./ticket";

export type AutomationChannel = "email" | "whatsapp";

export interface AutomationEndpoint {
  channel: AutomationChannel;
  label: string;
  webhookUrl: string;
  isEnabled: boolean;
  lastHealthCheck?: {
    status: "healthy" | "unhealthy" | "unknown";
    checkedAt: string;
    latencyMs?: number;
    message?: string;
  };
}

export type AutomationTrigger =
  | "ticket-created"
  | "ticket-updated"
  | "ticket-closed"
  | "ticket-reply-from-team";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  channel: AutomationChannel;
  isActive: boolean;
  templateSubject?: string;
  templateBody: string;
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
  status: TicketStatus;
  message: string;
  ticketUrl?: string;
  /** Set when sent from Automation → Test (not a real ticket event). */
  test?: boolean;
};

export const AUTOMATION_TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: "ticket-created", label: "Ticket created" },
  { value: "ticket-updated", label: "Ticket updated" },
  { value: "ticket-closed", label: "Ticket closed" },
  { value: "ticket-reply-from-team", label: "Team reply on ticket" },
];

export const AUTOMATION_TEMPLATE_VARS = [
  "{{customerName}}",
  "{{ticketNumber}}",
  "{{companyName}}",
  "{{status}}",
  "{{ticketUrl}}",
  "{{subject}}",
  "{{title}}",
] as const;
