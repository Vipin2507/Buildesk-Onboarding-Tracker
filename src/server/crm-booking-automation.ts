import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  DEFAULT_CRM_AUTOMATION_RULES,
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  mergeCrmAutomationRules,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { localWallClockIso } from "@/lib/booking-slots";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { nowIso } from "@/types";
import type {
  AutomationEndpoint,
  AutomationLog,
  AutomationRule,
  AutomationSettings,
  AutomationTrigger,
} from "@/types/automation";
import { BOOKING_STATUS_LABEL, type BookingAppointment, type BookingAppointmentStatus } from "@/types/booking";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

function loadCrmAutomationConfig(db: ReturnType<typeof getDb>) {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-automation")).get();
  let snapshot: {
    settings?: AutomationSettings;
    rules?: AutomationRule[];
    endpoints?: AutomationEndpoint[];
    logs?: AutomationLog[];
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
    logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
  };
}

function appendServerCrmAutomationLog(db: ReturnType<typeof getDb>, log: AutomationLog) {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-automation")).get();
  let snapshot: Record<string, unknown> = {};
  if (row?.valueJson) {
    try {
      snapshot = JSON.parse(row.valueJson) as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
  }
  const existing = Array.isArray(snapshot.logs) ? (snapshot.logs as AutomationLog[]) : [];
  const nextLogs = [log, ...existing].slice(0, 500);
  const valueJson = JSON.stringify({ ...snapshot, logs: nextLogs });
  const now = nowIso();
  if (row) {
    db.update(t.appConfig)
      .set({ valueJson, updatedAt: now })
      .where(eq(t.appConfig.key, "crm-automation"))
      .run();
  } else {
    db.insert(t.appConfig)
      .values({ key: "crm-automation", valueJson, updatedAt: now })
      .run();
  }
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

  const bookingUrl = opts.bookingUrl ?? "/crm/bookings?tab=pending";
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
    bookingUrl: opts.bookingUrl,
  });
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
    bookingUrl: opts.bookingUrl,
  });
}

/** Compare wall-clock datetimes (YYYY-MM-DDTHH:mm:ss) in the host timezone. */
export function isBookingSlotInPast(startsAt: string, timezone: string): boolean {
  const slot = startsAt.slice(0, 19);
  const now = localWallClockIso(timezone);
  return slot <= now;
}
