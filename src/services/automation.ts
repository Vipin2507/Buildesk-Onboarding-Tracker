import { toast } from "sonner";

import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationLog,
  AutomationPayload,
  AutomationTrigger,
} from "@/types/automation";
import type { Ticket } from "@/types";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import {
  AUTOMATION_SAMPLE_VARS,
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { checkWahaSession, phoneToWahaChatId, sendWahaText } from "@/services/waha";
import { fetchN8nHealth, fetchN8nWebhook, normalizeIndiaPhone } from "@/lib/automationEndpoints";
import { N8N_EMAIL_SEGMENT, N8N_HEALTH_SEGMENT } from "@/data/automationDefaults";
import type { AutomationRule } from "@/types/automation";
import type { TicketStatus } from "@/types";

function logId() {
  return `AL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function summarizeResponse(body: string, max = 180) {
  const trimmed = body.trim();
  if (!trimmed) return "Empty response";
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function mergeEmailCc(globalCc?: string, ruleCc?: string): string {
  const parts = [globalCc, ruleCc].flatMap((value) =>
    value
      ? value
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  return [...new Set(parts)].join(", ");
}

function buildN8nPayload(
  payload: AutomationPayload,
  ruleMeta?: { templateId?: string; templateName?: string; emailCc?: string },
): Record<string, unknown> {
  const store = useAutomationStore.getState();
  const { waha, settings } = store;

  return {
    channel: payload.channel,
    templateId: ruleMeta?.templateId,
    templateName: ruleMeta?.templateName,
    trigger: payload.trigger,
    recipientPhone: normalizeIndiaPhone(payload.customerPhone) ?? payload.customerPhone,
    recipientEmail: payload.customerEmail,
    recipientName: payload.customerName,
    messageBody: payload.message,
    emailSubject: payload.subject,
    emailCc: mergeEmailCc(settings.emailCc, ruleMeta?.emailCc),
    delayHours: 0,
    entityType: "ticket",
    entityId: payload.ticketNumber,
    entityName: payload.subject,
    wahaApiUrl: waha.apiUrl,
    wahaApiKey: waha.apiKey,
    wahaSession: waha.sessionName,
    test: payload.test ?? false,
    ticketNumber: payload.ticketNumber,
    companyName: payload.companyName,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
    subject: payload.subject,
    status: payload.status,
    message: payload.message,
    ticketUrl: payload.ticketUrl,
  };
}

export async function sendAutomationRequest(
  endpoint: AutomationEndpoint,
  payload: AutomationPayload,
  meta?: {
    ticketId?: string;
    companyId?: string;
    existingLogId?: string;
    templateId?: string;
    templateName?: string;
    emailCc?: string;
  },
): Promise<AutomationLog> {
  const store = useAutomationStore.getState();

  if (!store.settings.automationsEnabled) {
    const attemptedAt = new Date().toISOString();
    const log: AutomationLog = {
      id: meta?.existingLogId ?? logId(),
      ticketId: meta?.ticketId,
      ticketNumber: payload.ticketNumber,
      companyId: meta?.companyId,
      channel: payload.channel,
      trigger: payload.trigger,
      status: "failed",
      requestPayload: payload as unknown as Record<string, unknown>,
      errorMessage: "Automations are globally disabled",
      attemptedAt,
      retryCount: 0,
    };
    store.upsertLog(log);
    return log;
  }
  const attemptedAt = new Date().toISOString();
  const baseLog: AutomationLog = {
    id: meta?.existingLogId ?? logId(),
    ticketId: meta?.ticketId,
    ticketNumber: payload.ticketNumber,
    companyId: meta?.companyId,
    channel: payload.channel,
    trigger: payload.trigger,
    status: "retrying",
    requestPayload: payload as unknown as Record<string, unknown>,
    attemptedAt,
    retryCount: meta?.existingLogId
      ? (store.logs.find((l) => l.id === meta.existingLogId)?.retryCount ?? 0) + 1
      : 0,
  };

  if (!endpoint.isEnabled) {
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: `${endpoint.label} is disabled`,
    };
    store.upsertLog(log);
    return log;
  }

  store.upsertLog(baseLog);

  if (payload.channel === "whatsapp") {
    return sendViaWaha(store.waha, baseLog, payload);
  }

  const n8nBody = buildN8nPayload(payload, {
    templateId: meta?.templateId,
    templateName: meta?.templateName,
    emailCc: meta?.emailCc,
  });

  store.upsertLog({
    ...baseLog,
    requestPayload: n8nBody,
  });

  try {
    const result = await fetchN8nWebhook(
      N8N_EMAIL_SEGMENT,
      n8nBody,
      store.settings.n8nWebhookBase,
    );
    if (!result.ok) {
      const log: AutomationLog = {
        ...baseLog,
        status: "failed",
        errorMessage: `HTTP ${result.status}: ${summarizeResponse(result.text, 240)}`,
        responseSummary: summarizeResponse(result.text),
        requestPayload: n8nBody,
      };
      store.upsertLog(log);
      return log;
    }
    const log: AutomationLog = {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(result.text),
      requestPayload: n8nBody,
    };
    store.upsertLog(log);
    return log;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: message,
      requestPayload: n8nBody,
    };
    store.upsertLog(log);
    return log;
  }
}

async function sendViaWaha(
  waha: ReturnType<typeof useAutomationStore.getState>["waha"],
  baseLog: AutomationLog,
  payload: AutomationPayload,
): Promise<AutomationLog> {
  const store = useAutomationStore.getState();

  if (!waha.isEnabled) {
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: "WAHA WhatsApp is disabled",
    };
    store.upsertLog(log);
    return log;
  }

  const chatId = phoneToWahaChatId(payload.customerPhone);
  if (!chatId) {
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: "No valid customer phone number for WhatsApp",
      requestPayload: {
        ...(payload as unknown as Record<string, unknown>),
        provider: "waha",
      },
    };
    store.upsertLog(log);
    return log;
  }

  const wahaRequest = {
    provider: "waha" as const,
    session: waha.sessionName,
    chatId,
    text: payload.message,
  };

  store.upsertLog({
    ...baseLog,
    requestPayload: { ...(payload as unknown as Record<string, unknown>), ...wahaRequest },
  });

  try {
    const result = await sendWahaText(waha, chatId, payload.message);
    if (!result.ok) {
      const log: AutomationLog = {
        ...baseLog,
        status: "failed",
        errorMessage: `WAHA HTTP ${result.status}: ${summarizeResponse(result.body, 240)}`,
        responseSummary: summarizeResponse(result.body),
        requestPayload: { ...(payload as unknown as Record<string, unknown>), ...wahaRequest },
      };
      store.upsertLog(log);
      return log;
    }
    const log: AutomationLog = {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(result.body),
      requestPayload: { ...(payload as unknown as Record<string, unknown>), ...wahaRequest },
    };
    store.upsertLog(log);
    return log;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: message,
      requestPayload: { ...(payload as unknown as Record<string, unknown>), ...wahaRequest },
    };
    store.upsertLog(log);
    return log;
  }
}

export async function retryAutomationLog(logId: string): Promise<AutomationLog | null> {
  const store = useAutomationStore.getState();
  const log = store.logs.find((l) => l.id === logId);
  if (!log) return null;
  const endpoint = store.endpoints.find((e) => e.channel === log.channel);
  if (!endpoint) return null;
  return sendAutomationRequest(endpoint, log.requestPayload as unknown as AutomationPayload, {
    ticketId: log.ticketId,
    companyId: log.companyId,
    existingLogId: log.id,
  });
}

export async function checkHealth(): Promise<{
  email: AutomationEndpoint["lastHealthCheck"];
  whatsapp: AutomationEndpoint["lastHealthCheck"];
  health: AutomationHealthConfig["lastHealthCheck"];
}> {
  const store = useAutomationStore.getState();
  const { healthCheck, endpoints, waha, settings } = store;

  const emailStarted = performance.now();
  const emailCheckedAt = new Date().toISOString();
  let emailRaw = "";
  let emailOk = false;
  let emailMessage = "";

  try {
    const result = await fetchN8nHealth(
      settings.n8nWebhookBase,
      N8N_HEALTH_SEGMENT,
      healthCheck.httpMethod,
    );
    emailRaw = result.text;
    emailOk = result.ok;
    emailMessage = emailOk ? "n8n connection OK" : `HTTP ${result.status}`;
  } catch (err) {
    emailMessage = err instanceof Error ? err.message : "Network error";
  }

  const emailLatency = Math.round(performance.now() - emailStarted);
  const emailStatus = emailOk ? ("healthy" as const) : ("unhealthy" as const);
  const emailCheck = {
    status: emailStatus,
    checkedAt: emailCheckedAt,
    latencyMs: emailLatency,
    message: emailMessage,
  };

  const wahaCheck = await checkWahaSession(waha);

  store.setEndpointHealth("email", emailCheck);
  store.setWahaHealth(wahaCheck);
  store.setHealthCheckResult({
    status: emailStatus,
    checkedAt: emailCheckedAt,
    latencyMs: emailLatency,
    message: emailMessage,
    rawResponse: summarizeResponse(emailRaw, 400),
  });

  return {
    email: endpoints.find((e) => e.channel === "email")?.lastHealthCheck ?? emailCheck,
    whatsapp: endpoints.find((e) => e.channel === "whatsapp")?.lastHealthCheck ?? wahaCheck,
    health: store.healthCheck.lastHealthCheck ?? emailCheck,
  };
}

function buildTicketContext(ticket: Ticket) {
  const company = useCompanyStore.getState().companies.find((c) => c.id === ticket.companyId);
  const portal = useCompanyPortalStore.getState().access.find((a) => a.companyId === ticket.companyId);
  const slug = portal?.slug;
  const ticketUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/portal/${slug}/tickets`
      : undefined;

  return {
    companyName: company?.name ?? portal?.companyName ?? "Unknown company",
    customerName: portal?.contactName ?? company?.contact ?? company?.pocName ?? "Customer",
    customerEmail: portal?.contactEmail ?? company?.email,
    customerPhone: company?.phone || company?.pocMobile,
    ticketUrl,
  };
}

export function dispatchAutomationTrigger(
  trigger: AutomationTrigger,
  ticket: Ticket,
  opts?: { replyMessage?: string },
): void {
  void (async () => {
    const store = useAutomationStore.getState();
    if (!store.settings.automationsEnabled) return;
    const rules = store.rules.filter((r) => r.isActive && r.trigger === trigger);
    if (rules.length === 0) return;

    const ctx = buildTicketContext(ticket);
    const vars: Record<string, string> = {
      customerName: ctx.customerName,
      ticketNumber: ticket.id,
      companyName: ctx.companyName,
      status: ticket.status,
      ticketUrl: ctx.ticketUrl ?? "",
      subject: ticket.title,
      title: ticket.title,
    };

    for (const rule of rules) {
      const endpoint = store.endpoints.find((e) => e.channel === rule.channel);
      if (!endpoint) continue;

      const message = renderAutomationTemplate(
        opts?.replyMessage ? `${rule.templateBody}\n\nTeam reply:\n${opts.replyMessage}` : rule.templateBody,
        vars,
      );

      const payload: AutomationPayload = {
        channel: rule.channel,
        trigger,
        ticketNumber: ticket.id,
        companyName: ctx.companyName,
        customerName: ctx.customerName,
        customerEmail: ctx.customerEmail,
        customerPhone: ctx.customerPhone,
        subject: renderAutomationSubject(rule.templateSubject, vars),
        status: ticket.status,
        message,
        ticketUrl: ctx.ticketUrl,
      };

      const log = await sendAutomationRequest(endpoint, payload, {
        ticketId: ticket.id,
        companyId: ticket.companyId,
        templateId: rule.id,
        templateName: rule.name,
        emailCc: rule.emailCc,
      });

      const channelLabel = rule.channel === "email" ? "Email" : "WhatsApp";
      if (log.status === "success") {
        toast.success(`${channelLabel} notification sent`, {
          description: `${rule.name} · ${ticket.id}`,
          duration: 3500,
        });
      } else {
        toast.warning(`${channelLabel} notification failed`, {
          description: log.errorMessage ?? "Check Automation logs to retry",
          duration: 5000,
        });
      }
    }
  })().catch((err) => {
    console.warn("[automation] dispatch failed", err);
  });
}

export function isClosedTicketStatus(status: string) {
  return status === "Closed" || status === "Resolved";
}

function buildPayloadFromRule(
  rule: AutomationRule,
  opts?: { customerEmail?: string; customerPhone?: string; test?: boolean },
): AutomationPayload {
  const vars = { ...AUTOMATION_SAMPLE_VARS };
  const message = renderAutomationTemplate(rule.templateBody, vars);
  const prefix = opts?.test ? "[TEST] " : "";

  return {
    channel: rule.channel,
    trigger: rule.trigger,
    ticketNumber: vars.ticketNumber,
    companyName: vars.companyName,
    customerName: vars.customerName,
    customerEmail: opts?.customerEmail?.trim() || "test@example.com",
    customerPhone: opts?.customerPhone?.trim() || "+919999999999",
    subject: renderAutomationSubject(rule.templateSubject, vars),
    status: vars.status as TicketStatus,
    message: `${prefix}${message}`,
    ticketUrl: vars.ticketUrl,
    test: opts?.test ?? false,
  };
}

/** Send a sample notification for a rule (logged like production sends). */
export async function testAutomationRule(
  ruleId: string,
  overrides?: { customerEmail?: string; customerPhone?: string },
): Promise<AutomationLog | null> {
  const store = useAutomationStore.getState();
  const rule = store.rules.find((r) => r.id === ruleId);
  if (!rule) return null;

  const endpoint = store.endpoints.find((e) => e.channel === rule.channel);
  if (!endpoint) return null;

  const payload = buildPayloadFromRule(rule, { ...overrides, test: true });
  return sendAutomationRequest(endpoint, payload);
}

/** Send test using the first rule for a channel, or a minimal default template. */
export async function testAutomationChannel(
  channel: AutomationEndpoint["channel"],
  overrides?: { customerEmail?: string; customerPhone?: string },
): Promise<AutomationLog | null> {
  const store = useAutomationStore.getState();
  const rule =
    store.rules.find((r) => r.channel === channel) ??
    ({
      id: "test-fallback",
      name: `Test ${channel}`,
      trigger: "ticket-created" as const,
      channel,
      isActive: true,
      templateSubject: "Test notification — {{ticketNumber}}",
      templateBody: "Hi {{customerName}}, this is a test from Buildesk automation ({{companyName}}).",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies AutomationRule);

  const endpoint = store.endpoints.find((e) => e.channel === channel);
  if (!endpoint) return null;

  const payload = buildPayloadFromRule(rule, { ...overrides, test: true });
  return sendAutomationRequest(endpoint, payload);
}

export function notifyAutomationResult(log: AutomationLog, label: string) {
  const channelLabel = log.channel === "email" ? "Email" : "WhatsApp";
  if (log.status === "success") {
    toast.success(`${label} — ${channelLabel} sent`, {
      description: log.responseSummary ?? "Webhook accepted the test payload",
      duration: 4500,
    });
  } else {
    toast.warning(`${label} — ${channelLabel} failed`, {
      description: log.errorMessage ?? "See Automation logs to retry",
      duration: 5500,
    });
  }
}
