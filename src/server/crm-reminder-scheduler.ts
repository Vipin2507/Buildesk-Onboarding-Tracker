import { processTaskReminderAutomations } from "@/server/crm-task-reminder-automation";
import { processTaskWebPushReminders } from "@/server/crm-task-web-push";
import { getDb } from "@/server/db/client";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";

const TICK_MS = 60_000;

let started = false;

/** Background poll so task email/WhatsApp/web-push reminders fire without an open browser tab. */
export function startCrmReminderScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const db = getDb();
      await processTaskReminderAutomations(db, DEFAULT_BOOKING_TIMEZONE);
      await processTaskWebPushReminders(db, DEFAULT_BOOKING_TIMEZONE);
    } catch (err) {
      console.warn("[crm-reminder-scheduler]", err);
    }
  }

  setTimeout(() => void tick(), 8_000);
  setInterval(() => void tick(), TICK_MS);
}
