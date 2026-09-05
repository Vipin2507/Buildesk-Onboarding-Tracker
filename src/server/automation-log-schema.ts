import { z } from "zod";

import type { AutomationLog, AutomationTrigger } from "@/types/automation";

export const AUTOMATION_TRIGGER_VALUES = [
  "ticket-created",
  "ticket-updated",
  "ticket-closed",
  "ticket-reply-from-team",
  "booking-created",
  "booking-status-changed",
  "task-before-start",
] as const satisfies readonly AutomationTrigger[];

export const automationLogSchema = z.object({
  id: z.string(),
  ticketId: z.string().optional(),
  ticketNumber: z.string().optional(),
  companyId: z.string().optional(),
  channel: z.enum(["email", "whatsapp"]),
  trigger: z.enum(AUTOMATION_TRIGGER_VALUES),
  status: z.enum(["success", "failed", "retrying"]),
  requestPayload: z.record(z.string(), z.unknown()),
  responseSummary: z.string().optional(),
  errorMessage: z.string().optional(),
  attemptedAt: z.string(),
  retryCount: z.number(),
});

export function parseAutomationLog(input: unknown): AutomationLog {
  return automationLogSchema.parse(input) as AutomationLog;
}

export function parseAutomationLogs(input: unknown): AutomationLog[] {
  if (!Array.isArray(input)) return [];
  return input.map((entry) => parseAutomationLog(entry));
}
