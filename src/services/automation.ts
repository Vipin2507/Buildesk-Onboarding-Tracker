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

export async function sendAutomationRequest(
  endpoint: AutomationEndpoint,
  payload: AutomationPayload,
  meta?: { ticketId?: string; companyId?: string; existingLogId?: string },
): Promise<AutomationLog> {
  const store = useAutomationStore.getState();
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

  try {
    const res = await fetch(endpoint.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const log: AutomationLog = {
        ...baseLog,
        status: "failed",
        errorMessage: `HTTP ${res.status}: ${summarizeResponse(text, 240)}`,
        responseSummary: summarizeResponse(text),
      };
      store.upsertLog(log);
      return log;
    }
    const log: AutomationLog = {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(text),
    };
    store.upsertLog(log);
    return log;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const log: AutomationLog = {
      ...baseLog,
      status: "failed",
      errorMessage: message,
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
  const { healthCheck, endpoints } = store;
  const started = performance.now();
  const checkedAt = new Date().toISOString();

  let rawResponse = "";
  let ok = false;
  let message = "";

  try {
    const init: RequestInit = {
      method: healthCheck.httpMethod,
      headers: { Accept: "application/json" },
    };
    if (healthCheck.httpMethod === "POST") {
      init.headers = { ...init.headers, "Content-Type": "application/json" };
      init.body = JSON.stringify({ ping: true, source: "buildesk-compass" });
    }
    const res = await fetch(healthCheck.webhookUrl, init);
    rawResponse = await res.text().catch(() => "");
    ok = res.ok;
    message = ok ? "Connection OK" : `HTTP ${res.status}`;
  } catch (err) {
    message = err instanceof Error ? err.message : "Network error";
  }

  const latencyMs = Math.round(performance.now() - started);
  const status = ok ? ("healthy" as const) : ("unhealthy" as const);

  const endpointCheck = {
    status,
    checkedAt,
    latencyMs,
    message,
  };

  store.setEndpointHealth("email", endpointCheck);
  store.setEndpointHealth("whatsapp", endpointCheck);
  store.setHealthCheckResult({
    status,
    checkedAt,
    latencyMs,
    message,
    rawResponse: summarizeResponse(rawResponse, 400),
  });

  return {
    email: endpoints.find((e) => e.channel === "email")?.lastHealthCheck ?? endpointCheck,
    whatsapp: endpoints.find((e) => e.channel === "whatsapp")?.lastHealthCheck ?? endpointCheck,
    health: store.healthCheck.lastHealthCheck ?? endpointCheck,
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
