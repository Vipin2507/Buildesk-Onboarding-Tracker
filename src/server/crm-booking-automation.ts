import { eq } from "drizzle-orm";

import {
  DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  DEFAULT_CRM_AUTOMATION_RULES,
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  N8N_EMAIL_SEGMENT,
} from "@/data/crm-automation-defaults";
import { localWallClockIso } from "@/lib/booking-slots";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { AutomationEndpoint, AutomationRule, AutomationSettings } from "@/types/automation";
import type { BookingAppointment } from "@/types/booking";

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
  } = {};
  if (row?.valueJson) {
    try {
      snapshot = JSON.parse(row.valueJson) as typeof snapshot;
    } catch {
      snapshot = {};
    }
  }
  return {
    settings: { ...DEFAULT_CRM_AUTOMATION_SETTINGS, ...snapshot.settings },
    rules:
      Array.isArray(snapshot.rules) && snapshot.rules.length > 0
        ? snapshot.rules
        : DEFAULT_CRM_AUTOMATION_RULES,
    endpoints:
      Array.isArray(snapshot.endpoints) && snapshot.endpoints.length > 0
        ? snapshot.endpoints
        : DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  };
}

function formatBookingWhen(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
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
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "booking-created" && r.channel === "email",
  );
  if (rules.length === 0) return;

  const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
  if (!emailEndpoint) return;

  const bookingUrl = opts.bookingUrl ?? "/crm/bookings?tab=pending";
  const vars: Record<string, string> = {
    customerName: opts.hostName,
    accountName: opts.accountName,
    companyName: opts.accountName,
    salesManagerName: opts.hostName,
    status: "Pending",
    guestName: opts.appointment.guestName,
    guestEmail: opts.appointment.guestEmail,
    hostName: opts.hostName,
    hostEmail: opts.hostEmail ?? "",
    eventTypeTitle: opts.eventTitle,
    title: opts.eventTitle,
    subject: opts.eventTitle,
    startsAt: formatBookingWhen(opts.appointment.startsAt),
    endsAt: formatBookingWhen(opts.appointment.endsAt),
    previousStatus: "",
    bookingId: opts.appointment.id,
    bookingUrl,
    ticketNumber: opts.appointment.id,
    ticketUrl: bookingUrl,
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
      trigger: "booking-created",
      recipientEmail: opts.hostEmail,
      recipientName: opts.hostName,
      messageBody: message,
      emailSubject: subject,
      entityType: "crm-booking",
      productScope: "crm",
      entityId: opts.appointment.id,
      entityName: opts.eventTitle,
      companyName: opts.accountName,
      customerName: opts.hostName,
      customerEmail: opts.hostEmail,
      guestName: opts.appointment.guestName,
      guestEmail: opts.appointment.guestEmail,
      startsAt: vars.startsAt,
      endsAt: vars.endsAt,
      bookingId: opts.appointment.id,
      bookingUrl,
    };

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn("[booking-automation] executive email failed", err);
    }
  }
}

/** Compare wall-clock datetimes (YYYY-MM-DDTHH:mm:ss) in the host timezone. */
export function isBookingSlotInPast(startsAt: string, timezone: string): boolean {
  const slot = startsAt.slice(0, 19);
  const now = localWallClockIso(timezone);
  return slot <= now;
}
