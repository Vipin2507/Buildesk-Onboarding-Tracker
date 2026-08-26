import { processTaskInAppReminders } from "@/server/crm-task-in-app-reminder";
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
      const inAppSent = processTaskInAppReminders(db, DEFAULT_BOOKING_TIMEZONE);
      const pushSent = await processTaskWebPushReminders(db, DEFAULT_BOOKING_TIMEZONE);
      console.log(`[crm-reminder-scheduler] tick inApp=${inAppSent} push=${pushSent}`);
    } catch (err) {
      console.warn("[crm-reminder-scheduler]", err);
    }
  }

  console.log("[crm-reminder-scheduler] started (60s interval)");

  setTimeout(() => void tick(), 8_000);
  setInterval(() => void tick(), TICK_MS);
}
