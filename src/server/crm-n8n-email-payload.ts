import { DEFAULT_CRM_WAHA_CONFIG } from "@/data/crm-automation-defaults";
import { normalizeIndiaPhone } from "@/lib/automationEndpoints";
import type { AutomationRule, AutomationSettings, AutomationTrigger, WahaConfig } from "@/types/automation";

/** Merge global / rule / dynamic CC lists; dedupe case-insensitively. */
export function mergeServerEmailCc(
  ...parts: Array<string | string[] | undefined | null>
): string {
  const emails = parts.flatMap((value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out.join(", ");
}

export type ServerCrmN8nEmailInput = {
  rule: Pick<AutomationRule, "id" | "name" | "emailCc">;
  settings: AutomationSettings;
  waha?: WahaConfig;
  trigger: AutomationTrigger;
  recipientEmail: string;
  recipientName: string;
  recipientPhone?: string;
  messageBody: string;
  emailSubject: string;
  entityType: string;
  entityId: string;
  entityName: string;
  companyName?: string;
  status?: string;
  test?: boolean;
  /** Extra CC addresses (e.g. other internal-team members). */
  extraCc?: string[];
  /** Entity-specific fields merged into the n8n body (payment, booking, task, etc.). */
  fields?: Record<string, unknown>;
};

/** Canonical CRM email webhook body — matches client `buildN8nPayload` in crm-automation.ts. */
export function buildServerCrmN8nEmailBody(input: ServerCrmN8nEmailInput): Record<string, unknown> {
  const waha = input.waha ?? DEFAULT_CRM_WAHA_CONFIG;
  const customerPhone = normalizeIndiaPhone(input.recipientPhone) ?? input.recipientPhone ?? "";

  return {
    channel: "email",
    templateId: input.rule.id,
    templateName: input.rule.name,
    trigger: input.trigger,
    recipientPhone: customerPhone,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    messageBody: input.messageBody,
    emailSubject: input.emailSubject,
    emailCc: mergeServerEmailCc(input.settings.emailCc, input.rule.emailCc, input.extraCc),
    delayHours: 0,
    entityType: input.entityType,
    productScope: "crm",
    entityId: input.entityId,
    entityName: input.entityName,
    wahaApiUrl: waha.apiUrl,
    wahaApiKey: waha.apiKey,
    wahaSession: waha.sessionName,
    test: input.test ?? false,
    ticketNumber: input.entityId,
    companyName: input.companyName ?? input.entityName,
    customerName: input.recipientName,
    customerEmail: input.recipientEmail,
    customerPhone,
    subject: input.emailSubject,
    status: input.status ?? "",
    message: input.messageBody,
    ...(input.fields ?? {}),
  };
}
