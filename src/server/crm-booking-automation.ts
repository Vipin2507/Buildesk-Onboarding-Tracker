import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  DEFAULT_CRM_AUTOMATION_RULES,
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  DEFAULT_CRM_WAHA_CONFIG,
  mergeCrmAutomationRules,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { absoluteAppUrl } from "@/lib/app-base-url";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import { localWallClockIso } from "@/lib/booking-slots";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { appendAutomationLogToConfig } from "@/server/automation-log-persistence";
import { resolveCrmQueryResponseRecipientUserIds } from "@/server/api/notifications";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { nowIso } from "@/types";
import type {
  AutomationEndpoint,
  AutomationLog,
  AutomationRule,
  AutomationSettings,
  AutomationTrigger,
  WahaConfig,
} from "@/types/automation";
import { BOOKING_STATUS_LABEL, type BookingAppointment, type BookingAppointmentStatus } from "@/types/booking";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

export function loadCrmAutomationConfig(db: ReturnType<typeof getDb>) {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-automation")).get();
  let snapshot: {
    settings?: AutomationSettings;
    rules?: AutomationRule[];
    endpoints?: AutomationEndpoint[];
    logs?: AutomationLog[];
    waha?: WahaConfig;
  } = {};
  if (row?.valueJson) {
    try {
      snapshot = JSON.parse(row.valueJson) as typeof snapshot;
    } catch {
      snapshot = {};
    }
  }
  const existingRules =
    Array.isArray(snapshot.rules) && snapshot.rules.length > 0 ? snapshot.rules : [];
  return {
    settings: { ...DEFAULT_CRM_AUTOMATION_SETTINGS, ...snapshot.settings },
    rules:
      existingRules.length > 0
        ? mergeCrmAutomationRules(existingRules)
        : DEFAULT_CRM_AUTOMATION_RULES,
    endpoints:
      Array.isArray(snapshot.endpoints) && snapshot.endpoints.length > 0
        ? snapshot.endpoints
        : DEFAULT_CRM_AUTOMATION_ENDPOINTS,
    waha: { ...DEFAULT_CRM_WAHA_CONFIG, ...snapshot.waha },
    logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
  };
}

export function appendServerCrmAutomationLog(db: ReturnType<typeof getDb>, log: AutomationLog) {
  appendAutomationLogToConfig(db, "crm-automation", log);
}

function formatBookingWhen(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `CAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultBookingReviewUrl(appointmentId: string) {
  return absoluteAppUrl(
    `/crm/bookings?tab=pending&appointmentId=${encodeURIComponent(appointmentId)}`,
  );
}

async function sendServerWahaText(waha: WahaConfig, chatId: string, text: string) {
  const res = await fetch(`${trimSlash(waha.apiUrl)}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": waha.apiKey,
    },
    body: JSON.stringify({
      session: waha.sessionName,
      chatId,
      text,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, text: body };
}

function buildBookingCreatedVars(opts: {
  appointment: BookingAppointment;
  eventTitle: string;
  accountName: string;
  hostName: string;
  recipientName: string;
  bookingUrl: string;
  salesManagerName?: string | null;
  supportManager1?: string | null;
  supportManager2?: string | null;
}): Record<string, string> {
  const statusLabel = BOOKING_STATUS_LABEL[opts.appointment.status] ?? opts.appointment.status;
  return {
    customerName: opts.recipientName,
    recipientName: opts.recipientName,
    executiveName: opts.recipientName,
    assigneeName: opts.recipientName,
    accountName: opts.accountName,
    companyName: opts.accountName,
    salesManagerName: opts.salesManagerName?.trim() || opts.hostName,
    supportManager1: opts.supportManager1?.trim() || "—",
    supportManager2: opts.supportManager2?.trim() || "—",
    status: opts.appointment.status === "pending" ? "Pending" : statusLabel,
    guestName: opts.appointment.guestName,
    guestEmail: opts.appointment.guestEmail,
    hostName: opts.hostName,
    eventTypeTitle: opts.eventTitle,
    title: opts.eventTitle,
    subject: opts.eventTitle,
    startsAt: formatBookingWhen(opts.appointment.startsAt),
    endsAt: formatBookingWhen(opts.appointment.endsAt),
    bookingId: opts.appointment.id,
    bookingUrl: opts.bookingUrl,
    ticketNumber: opts.appointment.id,
    ticketUrl: opts.bookingUrl,
    meetUrl: opts.appointment.meetUrl ?? "",
    meetUrlLine: opts.appointment.meetUrl ? `Google Meet: ${opts.appointment.meetUrl}\n` : "",
  };
}

async function dispatchServerBookingEmail(
  db: ReturnType<typeof getDb>,
  opts: {
    trigger: Extract<AutomationTrigger, "booking-created" | "booking-status-changed">;
    appointment: BookingAppointment;
    eventTitle: string;
    accountName: string;
    hostName: string;
    hostEmail?: string;
    previousStatus?: BookingAppointmentStatus;
    bookingUrl?: string;
  },
): Promise<void> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === opts.trigger && r.channel === "email",
  );
  if (rules.length === 0) return;

  const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
  if (!emailEndpoint) return;

  const bookingUrl =
    opts.bookingUrl ??
    (opts.trigger === "booking-created"
      ? defaultBookingReviewUrl(opts.appointment.id)
      : absoluteAppUrl("/crm/bookings"));
  const statusLabel = BOOKING_STATUS_LABEL[opts.appointment.status] ?? opts.appointment.status;
  const previousStatusLabel = opts.previousStatus
    ? (BOOKING_STATUS_LABEL[opts.previousStatus] ?? opts.previousStatus)
    : "";

  const recipientName = opts.trigger === "booking-created" ? opts.hostName : opts.appointment.guestName;
  const recipientEmail =
    opts.trigger === "booking-created" ? opts.hostEmail : opts.appointment.guestEmail;

  const vars: Record<string, string> = {
    customerName: recipientName,
    accountName: opts.accountName,
    companyName: opts.accountName,
    salesManagerName: opts.hostName,
    supportManagerName: opts.hostName,
    status: opts.trigger === "booking-created" ? "Pending" : statusLabel,
    previousStatus: previousStatusLabel,
    guestName: opts.appointment.guestName,
    guestEmail: opts.appointment.guestEmail,
    hostName: opts.hostName,
    hostEmail: opts.hostEmail ?? "",
    eventTypeTitle: opts.eventTitle,
    title: opts.eventTitle,
    subject: opts.eventTitle,
    startsAt: formatBookingWhen(opts.appointment.startsAt),
    endsAt: formatBookingWhen(opts.appointment.endsAt),
    bookingId: opts.appointment.id,
    bookingUrl,
    ticketNumber: opts.appointment.id,
    ticketUrl: bookingUrl,
    meetUrl: opts.appointment.meetUrl ?? "",
    meetUrlLine: opts.appointment.meetUrl ? `Google Meet: ${opts.appointment.meetUrl}\n` : "",
  };

  const n8nBase = config.settings.n8nWebhookBase || DEFAULT_CRM_AUTOMATION_SETTINGS.n8nWebhookBase;
  const url = buildN8nUrl(n8nBase, N8N_EMAIL_SEGMENT);

  for (const rule of rules) {
    const message = renderAutomationTemplate(rule.templateBody, vars);
    const subject = renderAutomationSubject(rule.templateSubject, vars);
    const body = {
      channel: "email" as const,
      templateId: rule.id,
      templateName: rule.name,
      trigger: opts.trigger,
      recipientEmail,
      recipientName,
      messageBody: message,
      emailSubject: subject,
      entityType: "crm-booking",
      productScope: "crm",
      entityId: opts.appointment.id,
      entityName: opts.eventTitle,
      companyName: opts.accountName,
      customerName: recipientName,
      customerEmail: recipientEmail,
      guestName: opts.appointment.guestName,
      guestEmail: opts.appointment.guestEmail,
      startsAt: vars.startsAt,
      endsAt: vars.endsAt,
      bookingId: opts.appointment.id,
      bookingUrl,
    };

    const attemptedAt = nowIso();
    const logId = serverLogId();
    const baseLog: AutomationLog = {
      id: logId,
      ticketNumber: opts.appointment.id,
      companyId: opts.appointment.companyId,
      channel: "email",
      trigger: opts.trigger,
      status: "retrying",
      requestPayload: body as unknown as Record<string, unknown>,
      attemptedAt,
      retryCount: 0,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: `HTTP ${res.status}: ${summarizeResponse(text, 240)}`,
          responseSummary: summarizeResponse(text),
        });
        console.warn("[booking-automation] email failed", opts.trigger, res.status);
        continue;
      }
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "success",
        responseSummary: summarizeResponse(text),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: message,
      });
      console.warn("[booking-automation] email failed", opts.trigger, err);
    }
  }
}

async function dispatchBookingCreatedWhatsAppForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  input: {
    appointment: BookingAppointment;
    eventTitle: string;
    accountName: string;
    hostName: string;
    bookingUrl: string;
    salesManagerName?: string | null;
    supportManager1?: string | null;
    supportManager2?: string | null;
    recipient: { id: string; name: string; phone?: string | null };
  },
): Promise<boolean> {
  const vars = buildBookingCreatedVars({
    appointment: input.appointment,
    eventTitle: input.eventTitle,
    accountName: input.accountName,
    hostName: input.hostName,
    recipientName: input.recipient.name,
    bookingUrl: input.bookingUrl,
    salesManagerName: input.salesManagerName,
    supportManager1: input.supportManager1,
    supportManager2: input.supportManager2,
  });
  const message = renderAutomationTemplate(rule.templateBody, vars);

  const userRow = db.select().from(t.users).where(eq(t.users.id, input.recipient.id)).get();
  const recipientPhone = userRow?.phone ?? input.recipient.phone ?? undefined;

  const attemptedAt = nowIso();
  const baseLog: AutomationLog = {
    id: serverLogId(),
    ticketNumber: input.appointment.id,
    companyId: input.appointment.companyId,
    channel: "whatsapp",
    trigger: "booking-created",
    status: "retrying",
    requestPayload: {
      bookingId: input.appointment.id,
      ruleId: rule.id,
      recipientUserId: input.recipient.id,
    },
    attemptedAt,
    retryCount: 0,
  };

  const wahaEndpoint = config.endpoints.find((e) => e.channel === "whatsapp" && e.isEnabled);
  if (!wahaEndpoint || !config.waha.isEnabled) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "WhatsApp endpoint disabled",
    });
    return false;
  }

  const chatId = phoneToWahaChatId(recipientPhone ?? undefined);
  if (!chatId) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "Recipient has no valid phone for WhatsApp",
    });
    return false;
  }

  try {
    const res = await sendServerWahaText(config.waha, chatId, message);
    if (!res.ok) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: `HTTP ${res.status}: ${summarizeResponse(res.text, 240)}`,
        responseSummary: summarizeResponse(res.text),
        requestPayload: { chatId, message },
      });
      return false;
    }
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(res.text),
      requestPayload: { chatId, message },
    });
    return true;
  } catch (err) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Network error",
    });
    return false;
  }
}

/** Server-side executive email when a portal guest books (no CRM session required). */
export async function dispatchServerBookingCreatedEmail(
  db: ReturnType<typeof getDb>,
  opts: {
    appointment: BookingAppointment;
    eventTitle: string;
    accountName: string;
    hostName: string;
    hostEmail?: string;
    bookingUrl?: string;
  },
): Promise<void> {
  await dispatchServerBookingEmail(db, {
    trigger: "booking-created",
    appointment: opts.appointment,
    eventTitle: opts.eventTitle,
    accountName: opts.accountName,
    hostName: opts.hostName,
    hostEmail: opts.hostEmail,
    bookingUrl: opts.bookingUrl ?? defaultBookingReviewUrl(opts.appointment.id),
  });
}

/**
 * WhatsApp host + related CRM executives when a client books a call from the portal.
 * Link opens CRM Meetings so they can approve, reject, or postpone.
 */
export async function dispatchServerBookingCreatedWhatsApp(
  db: ReturnType<typeof getDb>,
  opts: {
    appointment: BookingAppointment;
    eventTitle: string;
    accountName: string;
    hostName: string;
    bookingUrl?: string;
  },
): Promise<void> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "booking-created" && r.channel === "whatsapp",
  );
  if (rules.length === 0) return;

  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, opts.appointment.companyId))
    .get();

  const recipientIds = new Set<string>(
    resolveCrmQueryResponseRecipientUserIds(db, opts.appointment.companyId),
  );
  if (opts.appointment.hostUserId) recipientIds.add(opts.appointment.hostUserId);
  if (!recipientIds.size) return;

  const users = db.select().from(t.users).all();
  const recipients = [...recipientIds]
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.active !== false))
    .map((u) => ({ id: u.id, name: u.name, phone: u.phone }));

  const bookingUrl = opts.bookingUrl ?? defaultBookingReviewUrl(opts.appointment.id);

  for (const rule of rules) {
    for (const recipient of recipients) {
      await dispatchBookingCreatedWhatsAppForRule(db, config, rule, {
        appointment: opts.appointment,
        eventTitle: opts.eventTitle,
        accountName: opts.accountName,
        hostName: opts.hostName,
        bookingUrl,
        salesManagerName: account?.salesManagerName,
        supportManager1: account?.supportManager1,
        supportManager2: account?.supportManager2,
        recipient,
      });
    }
  }
}

/** Server-side guest email when a booking is approved, declined, cancelled, or postponed. */
export async function dispatchServerBookingStatusChangedEmail(
  db: ReturnType<typeof getDb>,
  opts: {
    appointment: BookingAppointment;
    previousStatus: BookingAppointmentStatus;
    eventTitle: string;
    accountName: string;
    hostName: string;
    hostEmail?: string;
    bookingUrl?: string;
  },
): Promise<void> {
  await dispatchServerBookingEmail(db, {
    trigger: "booking-status-changed",
    appointment: opts.appointment,
    previousStatus: opts.previousStatus,
    eventTitle: opts.eventTitle,
    accountName: opts.accountName,
    hostName: opts.hostName,
    hostEmail: opts.hostEmail,
    bookingUrl: opts.bookingUrl ?? absoluteAppUrl("/crm/bookings"),
  });
}

/** Compare wall-clock datetimes (YYYY-MM-DDTHH:mm:ss) in the host timezone. */
export function isBookingSlotInPast(startsAt: string, timezone: string): boolean {
  const slot = startsAt.slice(0, 19);
  const now = localWallClockIso(timezone);
  return slot <= now;
}
