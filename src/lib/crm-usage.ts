import type { CrmUsageRecommendation, CrmUsageScanRow } from "@/types/crm-usage";

/** Lead receipt alone is not CRM usage. Follow-ups, visits, bookings, and other workflow actions are. */
export function usageTag(row: Pick<
  CrmUsageScanRow,
  "ok" | "connected" | "leadOnly" | "hasCrmActivity" | "hasCalls"
> | null): string {
  if (!row) return "Not loaded";
  if (!row.connected) return "Not connected";
  if (!row.ok) return "API error";
  if (row.leadOnly) return "Leads only";
  if (row.hasCrmActivity && row.hasCalls) return "Calls + CRM";
  if (row.hasCrmActivity) return "Using CRM";
  if (row.hasCalls) return "Calls only";
  return "No CRM activity";
}

export function usageTagTone(
  tag: string,
): "muted" | "accent" | "success" | "warning" | "danger" {
  if (tag === "Using CRM" || tag === "Calls + CRM") return "success";
  if (tag === "Calls only" || tag === "Leads only") return "warning";
  if (tag === "API error") return "danger";
  if (tag === "No CRM activity" || tag === "Not connected" || tag === "Not saved") return "muted";
  return "accent";
}

export function usageFocus(
  row: CrmUsageScanRow | null,
  licensedUsers: number,
): string {
  if (!row) return "Refresh analysis to load this window.";
  if (!row.connected) {
    return "No Buildesk dashboard key on this account. Connect the portal key or the health-monitor catalog.";
  }
  if (!row.ok) return row.error || "The Buildesk report did not load.";
  if (row.leadOnly) {
    return "Leads are arriving, but nobody is following up, visiting, booking, or calling.";
  }
  if (!row.hasCrmActivity && row.hasCalls) {
    return "Calls are logged, but there is no follow-up, visit, meeting, or booking activity.";
  }
  if (!row.hasCrmActivity) {
    return "No CRM actions in this window. Check whether the team is working outside Buildesk.";
  }
  const seats =
    licensedUsers > 0 && row.activeUsers / licensedUsers < 0.4
      ? ` Only ${row.activeUsers} of ${licensedUsers} licensed users were active.`
      : "";
  if (row.bookings === 0 && row.leads > 0) {
    return `Leads are being worked, but no bookings were recorded.${seats}`;
  }
  if (row.bookingWarning) {
    return `CRM activity is present. Booking totals need a retry.${seats}`;
  }
  if (seats) return `Usage is active.${seats}`;
  return "Team is using CRM in this window. Keep the follow-up and visit cadence.";
}

export function usageRecommendations(input: {
  leads: number;
  calls: number;
  followups: number;
  visitsScheduled: number;
  visitsConducted: number;
  bookings: number | null;
  activeUsers: number;
  licensedUsers: number;
  hasCrmActivity: boolean;
  hasCalls: boolean;
  leadOnly: boolean;
  bookingWarning: string;
}): CrmUsageRecommendation[] {
  const out: CrmUsageRecommendation[] = [];
  if (input.leadOnly) {
    out.push({
      priority: "High",
      finding: "Leads are recorded without follow-ups, visits, bookings, or calls",
      action: "Sit with the sales owner and confirm the team works leads inside Buildesk the same day they arrive.",
    });
  } else if (!input.hasCrmActivity && !input.hasCalls) {
    out.push({
      priority: "High",
      finding: "No tracked CRM or call activity in this period",
      action: "Confirm the account is still live, then book a short adoption check with the customer success owner.",
    });
  } else if (!input.hasCrmActivity && input.hasCalls) {
    out.push({
      priority: "Medium",
      finding: "Calls are logged, but CRM workflow actions are missing",
      action: "Ask the team to log follow-ups and site visits against the leads they are already calling.",
    });
  }
  if (input.licensedUsers > 0 && input.activeUsers / input.licensedUsers < 0.4) {
    out.push({
      priority: "Medium",
      finding: `${input.activeUsers} of ${input.licensedUsers} licensed users had productive activity`,
      action: "Review inactive seats with the admin. Unused licenses are a renewal risk.",
    });
  }
  if (input.bookings === 0 && input.leads > 0 && !input.bookingWarning) {
    out.push({
      priority: "Medium",
      finding: "Leads were recorded and bookings were zero",
      action: "Check whether bookings are entered in CRM or kept in another sheet.",
    });
  }
  if (input.bookingWarning) {
    out.push({
      priority: "Low",
      finding: "The daywise booking report did not refresh",
      action: "Retry this account before quoting booking numbers to the customer.",
    });
  }
  if (input.followups === 0 && input.leads >= 5 && input.hasCrmActivity) {
    out.push({
      priority: "Medium",
      finding: "Leads exist without follow-ups",
      action: "Review the follow-up queue with the team lead.",
    });
  }
  if (input.visitsScheduled >= 5 && input.visitsConducted * 2 < input.visitsScheduled) {
    out.push({
      priority: "Medium",
      finding: "Many site visits are scheduled and few are marked conducted",
      action: "Confirm visit outcomes are being closed in CRM after the visit.",
    });
  }
  if (out.length === 0) {
    out.push({
      priority: "Low",
      finding: "Activity is present across the selected window",
      action: "Use the user table to thank active executives and coach anyone with leads but no follow-up.",
    });
  }
  return out;
}

export function usagePatternLabel(days: { ok: boolean; hasCrmActivity: boolean }[]): string {
  const saved = days.filter((day) => day.ok);
  if (!saved.length) return "No days loaded";
  const active = saved.filter((day) => day.hasCrmActivity).length;
  if (active === 0) return "No CRM use";
  const ratio = active / saved.length;
  if (saved.length >= 7 && active >= 2 && active <= 3) return "2–3 days use";
  if (ratio >= 0.75) return "Daily use";
  if (ratio >= 0.4) return "Frequent use";
  if (active <= 3) return "2–3 days use";
  return "Low use";
}

export function shiftIsoDate(iso: string, delta: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function eachIsoDay(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 120) {
    days.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return days;
}

/** Calendar date in India, where the nightly usage refresh runs. */
export function istToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function istHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

export function chunkIds<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
