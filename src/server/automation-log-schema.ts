import { z } from "zod";

import type { AutomationLogWire, AutomationTrigger, JsonValue } from "@/types/automation";

export const AUTOMATION_TRIGGER_VALUES = [
  "ticket-created",
  "ticket-updated",
  "ticket-closed",
  "ticket-reply-from-team",
  "booking-created",
  "booking-status-changed",
  "task-before-start",
] as const satisfies readonly AutomationTrigger[];

const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonLiteralSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const automationLogWireSchema = z.object({
  id: z.string(),
  ticketId: z.string().optional(),
  ticketNumber: z.string().optional(),
  companyId: z.string().optional(),
  channel: z.enum(["email", "whatsapp"]),
  trigger: z.enum(AUTOMATION_TRIGGER_VALUES),
  status: z.enum(["success", "failed", "retrying"]),
  requestPayload: z.record(z.string(), jsonValueSchema),
  responseSummary: z.string().optional(),
  errorMessage: z.string().optional(),
  attemptedAt: z.string(),
  retryCount: z.number(),
});

export function parseAutomationLogWire(input: unknown): AutomationLogWire {
  return automationLogWireSchema.parse(input);
}
