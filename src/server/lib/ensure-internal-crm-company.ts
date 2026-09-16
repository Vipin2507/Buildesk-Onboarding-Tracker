import { eq } from "drizzle-orm";

import { CRM_ACCOUNT_COMPANY_MARKER } from "@/lib/design-ticket-portal";
import {
  INTERNAL_CRM_TASK_ACCOUNT_LABEL,
  INTERNAL_CRM_TASK_COMPANY_ID,
} from "@/lib/crm-internal-task";
import { nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

/**
 * Internal CRM meetings use a sentinel companyId for the follow_up_tasks FK.
 * Ensure that stub row exists so creates persist (foreign_keys = ON).
 */
export function ensureInternalCrmCompanyRow() {
  const db = getDb();
  const existing = db
    .select({ id: t.companies.id })
    .from(t.companies)
    .where(eq(t.companies.id, INTERNAL_CRM_TASK_COMPANY_ID))
    .get();
  if (existing) return;

  const now = nowIso();
  const day = now.slice(0, 10);
  db.insert(t.companies)
    .values({
      id: INTERNAL_CRM_TASK_COMPANY_ID,
      name: INTERNAL_CRM_TASK_ACCOUNT_LABEL,
      contact: INTERNAL_CRM_TASK_ACCOUNT_LABEL,
      designation: "Internal",
      phone: "—",
      email: "internal@buildesk.local",
      city: "—",
      region: "Rest of India",
      ownerName: "",
      ownerMobile: "",
      pocName: "",
      pocMobile: "",
      billingInfo: CRM_ACCOUNT_COMPANY_MARKER,
      onboardingManagerId: "crm-internal",
      csmId: "crm-internal",
      status: "in_progress",
      agreementDate: day,
      startDate: day,
      goLiveTarget: day,
      planExpiry: day,
      plan: "Annual",
      health: "Healthy",
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
