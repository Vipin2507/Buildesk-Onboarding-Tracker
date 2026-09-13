import { eq } from "drizzle-orm";

import { localWallClockIso } from "@/lib/booking-slots";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

const DEFAULT_TZ = "Asia/Kolkata";

export function resolveDprOrgTimezone(db: ReturnType<typeof getDb> = getDb()): string {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "settings")).get();
  if (!row?.valueJson) return DEFAULT_TZ;
  try {
    const parsed = JSON.parse(row.valueJson) as { org?: { timezone?: string } };
    const tz = parsed.org?.timezone?.trim();
    if (tz) return tz;
  } catch {
    /* default */
  }
  return DEFAULT_TZ;
}

export function dprWallClockNow(db: ReturnType<typeof getDb> = getDb()): string {
  return localWallClockIso(resolveDprOrgTimezone(db));
}
