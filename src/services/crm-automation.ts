import { toast } from "sonner";

import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationLog,
  AutomationPayload,
  AutomationRule,
  AutomationTrigger,
} from "@/types/automation";
import type { Ticket, TicketStatus } from "@/types";
import type { BookingAppointment, BookingAppointmentStatus } from "@/types/booking";
import { BOOKING_STATUS_LABEL } from "@/types/booking";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useUserStore } from "@/stores/useUserStore";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { checkWahaSession, phoneToWahaChatId, sendWahaText } from "@/services/waha";
import { fetchN8nHealth, fetchN8nWebhook, normalizeIndiaPhone } from "@/lib/automationEndpoints";
import {
  CRM_AUTOMATION_SAMPLE_VARS,
  N8N_EMAIL_SEGMENT,
  N8N_HEALTH_SEGMENT,
} from "@/data/crm-automation-defaults";

function logId() {
  return `CAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  const store = useCrmAutomationStore.getState();
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
    entityType: payload.bookingId ? "crm-booking" : "crm-ticket",
    productScope: "crm",
    entityId: payload.bookingId ?? payload.ticketNumber,
    entityName: payload.eventTypeTitle ?? payload.subject,
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
    bookingId: payload.bookingId,
    bookingUrl: payload.bookingUrl,
    eventTypeTitle: payload.eventTypeTitle,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    hostName: payload.hostName,
    guestName: payload.guestName,
    guestEmail: payload.guestEmail,
  };
}

export async function sendCrmAutomationRequest(
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
  const store = useCrmAutomationStore.getState();

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
  waha: ReturnType<typeof useCrmAutomationStore.getState>["waha"],
  baseLog: AutomationLog,
  payload: AutomationPayload,
): Promise<AutomationLog> {
  const store = useCrmAutomationStore.getState();

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

export async function retryCrmAutomationLog(logId: string): Promise<AutomationLog | null> {
  const store = useCrmAutomationStore.getState();
  const log = store.logs.find((l) => l.id === logId);
  if (!log) return null;
  const endpoint = store.endpoints.find((e) => e.channel === log.channel);
  if (!endpoint) return null;
  return sendCrmAutomationRequest(endpoint, log.requestPayload as unknown as AutomationPayload, {
    ticketId: log.ticketId,
    companyId: log.companyId,
    existingLogId: log.id,
  });
}

export async function checkCrmAutomationHealth(): Promise<{
  email: AutomationEndpoint["lastHealthCheck"];
  whatsapp: AutomationEndpoint["lastHealthCheck"];
  health: AutomationHealthConfig["lastHealthCheck"];
}> {
  const store = useCrmAutomationStore.getState();
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

function buildCrmTicketContext(ticket: Ticket) {
  const account = useCrmAccountStore.getState().getById(ticket.companyId);
  const portal = useCompanyPortalStore.getState().access.find((a) => a.companyId === ticket.companyId);
  const ticketUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/crm/support/${ticket.id}`
      : undefined;

  const accountName = account?.name ?? portal?.companyName ?? "CRM account";
  const customerName =
    account?.ownerName ||
    account?.contact ||
    account?.pocName ||
    portal?.contactName ||
    "Customer";

  return {
    accountName,
    companyName: accountName,
    customerName,
    customerEmail: account?.ownerEmail || account?.email || portal?.contactEmail,
    customerPhone: account?.ownerPhone || account?.phone || account?.pocMobile || undefined,
    salesManagerName: account?.salesManagerName ?? "",
    ticketUrl,
  };
}

export function dispatchCrmAutomationTrigger(
  trigger: AutomationTrigger,
  ticket: Ticket,
  opts?: { replyMessage?: string },
): void {
  void (async () => {
    const store = useCrmAutomationStore.getState();
    if (!store.settings.automationsEnabled) return;
    const rules = store.rules.filter((r) => r.isActive && r.trigger === trigger);
    if (rules.length === 0) return;

    const ctx = buildCrmTicketContext(ticket);
    const vars: Record<string, string> = {
      customerName: ctx.customerName,
      ticketNumber: ticket.id,
      accountName: ctx.accountName,
      companyName: ctx.companyName,
      salesManagerName: ctx.salesManagerName,
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
        companyName: ctx.accountName,
        customerName: ctx.customerName,
        customerEmail: ctx.customerEmail,
        customerPhone: ctx.customerPhone,
        subject: renderAutomationSubject(rule.templateSubject, vars),
        status: ticket.status,
        message,
        ticketUrl: ctx.ticketUrl,
      };

      const log = await sendCrmAutomationRequest(endpoint, payload, {
        ticketId: ticket.id,
        companyId: ticket.companyId,
        templateId: rule.id,
        templateName: rule.name,
        emailCc: rule.emailCc,
      });

      const channelLabel = rule.channel === "email" ? "Email" : "WhatsApp";
      if (log.status === "success") {
        toast.success(`CRM ${channelLabel} notification sent`, {
          description: `${rule.name} · ${ticket.id}`,
          duration: 3500,
        });
      } else {
        toast.warning(`CRM ${channelLabel} notification failed`, {
          description: log.errorMessage ?? "Check CRM Automation logs to retry",
          duration: 5000,
        });
      }
    }
  })().catch((err) => {
    console.warn("[crm-automation] dispatch failed", err);
  });
}

export function isCrmClosedTicketStatus(status: string) {
  return status === "Closed" || status === "Resolved";
}

function buildPayloadFromRule(
  rule: AutomationRule,
  opts?: { customerEmail?: string; customerPhone?: string; test?: boolean },
): AutomationPayload {
  const vars = { ...CRM_AUTOMATION_SAMPLE_VARS };
  const message = renderAutomationTemplate(rule.templateBody, vars);
  const prefix = opts?.test ? "[TEST] " : "";

  return {
    channel: rule.channel,
    trigger: rule.trigger,
    ticketNumber: vars.ticketNumber,
    companyName: vars.accountName || vars.companyName,
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
export async function testCrmAutomationRule(
  ruleId: string,
  overrides?: { customerEmail?: string; customerPhone?: string },
): Promise<AutomationLog | null> {
  const store = useCrmAutomationStore.getState();
  const rule = store.rules.find((r) => r.id === ruleId);
  if (!rule) return null;

  const endpoint = store.endpoints.find((e) => e.channel === rule.channel);
  if (!endpoint) return null;

  const payload = buildPayloadFromRule(rule, { ...overrides, test: true });
  return sendCrmAutomationRequest(endpoint, payload);
}

/** Send test using the first rule for a channel, or a minimal default template. */
export async function testCrmAutomationChannel(
  channel: AutomationEndpoint["channel"],
  overrides?: { customerEmail?: string; customerPhone?: string },
): Promise<AutomationLog | null> {
  const store = useCrmAutomationStore.getState();
  const rule =
    store.rules.find((r) => r.channel === channel) ??
    ({
      id: "test-fallback",
      name: `Test ${channel}`,
      trigger: "ticket-created" as const,
      channel,
      isActive: true,
      templateSubject: "Test notification — {{ticketNumber}}",
      templateBody: "Hi {{customerName}}, this is a test from Buildesk CRM automation ({{companyName}}).",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies AutomationRule);

  const endpoint = store.endpoints.find((e) => e.channel === channel);
  if (!endpoint) return null;

  const payload = buildPayloadFromRule(rule, { ...overrides, test: true });
  return sendCrmAutomationRequest(endpoint, payload);
}

export function notifyCrmAutomationResult(log: AutomationLog, label: string) {
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

function formatBookingWhen(iso: string) {
  const d = iso.slice(0, 10);
  const t = iso.slice(11, 16);
  return `${d} ${t}`;
}

/** Notify executive (host) on new booking, or guest on status change. */
export function dispatchCrmBookingAutomationTrigger(
  trigger: "booking-created" | "booking-status-changed",
  appointment: BookingAppointment,
  opts?: { previousStatus?: BookingAppointmentStatus },
): void {
  void (async () => {
    const store = useCrmAutomationStore.getState();
    if (!store.settings.automationsEnabled) return;
    const rules = store.rules.filter((r) => r.isActive && r.trigger === trigger);
    if (rules.length === 0) return;

    const account = useCrmAccountStore.getState().getById(appointment.companyId);
    const eventType = useBookingStore
      .getState()
      .eventTypes.find((e) => e.id === appointment.eventTypeId);
    const host = useUserStore.getState().users.find((u) => u.id === appointment.hostUserId);
    const accountName = account?.name ?? "CRM account";
    const eventTitle = eventType?.title ?? "Call";
    const statusLabel = BOOKING_STATUS_LABEL[appointment.status] ?? appointment.status;
    const bookingUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/crm/bookings`
        : "/crm/bookings";

    const hostName = host?.name ?? "Host";
    const hostEmail = resolveUserWorkEmail(host);
    const guestName = appointment.guestName;
    const guestEmail = appointment.guestEmail;

    const recipientName = trigger === "booking-created" ? hostName : guestName;
    const recipientEmail = trigger === "booking-created" ? hostEmail : guestEmail;
    const recipientPhone =
      trigger === "booking-created" ? host?.phone : appointment.guestPhone;

    const vars: Record<string, string> = {
      customerName: recipientName,
      accountName,
      companyName: accountName,
      salesManagerName: account?.salesManagerName ?? hostName,
      status: statusLabel,
      previousStatus: opts?.previousStatus
        ? BOOKING_STATUS_LABEL[opts.previousStatus] ?? opts.previousStatus
        : "",
      guestName,
      guestEmail,
      hostName,
      hostEmail: hostEmail ?? "",
      eventTypeTitle: eventTitle,
      title: eventTitle,
      subject: eventTitle,
      startsAt: formatBookingWhen(appointment.startsAt),
      endsAt: formatBookingWhen(appointment.endsAt),
      bookingId: appointment.id,
      bookingUrl,
      ticketNumber: appointment.id,
      ticketUrl: bookingUrl,
      meetUrl: appointment.meetUrl ?? "",
      meetUrlLine: appointment.meetUrl ? `Google Meet: ${appointment.meetUrl}\n` : "",
    };

    for (const rule of rules) {
      const endpoint = store.endpoints.find((e) => e.channel === rule.channel);
      if (!endpoint) continue;

      const message = renderAutomationTemplate(rule.templateBody, vars);
      const payload: AutomationPayload = {
        channel: rule.channel,
        trigger,
        ticketNumber: appointment.id,
        companyName: accountName,
        customerName: recipientName,
        customerEmail: recipientEmail,
        customerPhone: recipientPhone,
        subject: renderAutomationSubject(rule.templateSubject, vars),
        status: statusLabel,
        message,
        ticketUrl: bookingUrl,
        bookingId: appointment.id,
        bookingUrl,
        eventTypeTitle: eventTitle,
        startsAt: vars.startsAt,
        endsAt: vars.endsAt,
        previousStatus: vars.previousStatus,
        hostName,
        hostEmail,
        guestName,
        guestEmail,
      };

      const log = await sendCrmAutomationRequest(endpoint, payload, {
        ticketId: appointment.id,
        companyId: appointment.companyId,
        templateId: rule.id,
        templateName: rule.name,
        emailCc: rule.emailCc,
      });

      const channelLabel = rule.channel === "email" ? "Email" : "WhatsApp";
      if (log.status === "success") {
        toast.success(`CRM ${channelLabel} notification sent`, {
          description: `${rule.name} · ${eventTitle}`,
          duration: 3500,
        });
      } else {
        toast.warning(`CRM ${channelLabel} notification failed`, {
          description: log.errorMessage ?? "Check CRM Automation logs",
          duration: 5000,
        });
      }
    }
  })().catch((err) => {
    console.warn("[crm-automation] booking dispatch failed", err);
  });
}
