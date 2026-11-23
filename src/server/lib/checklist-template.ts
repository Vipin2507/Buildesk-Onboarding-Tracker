import { and, eq } from "drizzle-orm";

import { CHECKLIST_TEMPLATE, VENDOR_CHECKLIST_LABELS } from "@/data/constants";
import { newId, nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

/** Insert any missing vendor checklist rows once the module is opted in. */
export function ensureVendorChecklistForCompany(companyId: string) {
  const db = getDb();
  const vendor = db
    .select()
    .from(t.companyModules)
    .where(
      and(
        eq(t.companyModules.companyId, companyId),
        eq(t.companyModules.moduleKey, "vendor-management"),
        eq(t.companyModules.optedIn, true),
      ),
    )
    .get();
  if (!vendor) return;
  const companyProjects = db
    .select()
    .from(t.projects)
    .where(eq(t.projects.companyId, companyId))
    .all();
  const now = nowIso();
  for (const project of companyProjects) {
    const existing = new Set(
      db
        .select({ label: t.onboardingChecklistItems.label })
        .from(t.onboardingChecklistItems)
        .where(
          and(
            eq(t.onboardingChecklistItems.projectId, project.id),
            eq(t.onboardingChecklistItems.section, "vendor"),
          ),
        )
        .all()
        .map((row) => row.label),
    );
    for (const label of VENDOR_CHECKLIST_LABELS) {
      if (existing.has(label)) continue;
      db.insert(t.onboardingChecklistItems)
        .values({
          id: newId(),
          projectId: project.id,
          section: "vendor",
          label,
          collected: false,
          uploaded: false,
          live: false,
          notApplicable: false,
          remarks: "",
          assigneeUserId: null,
          dueDate: null,
          source: "default",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

export function checklistTemplateForProject(projectId: string): Record<string, readonly string[]> {
  const db = getDb();
  const project = db.select().from(t.projects).where(eq(t.projects.id, projectId)).get();
  const template: Record<string, readonly string[]> = { ...CHECKLIST_TEMPLATE };
  if (!project) return template;
  const vendor = db
    .select()
    .from(t.companyModules)
    .where(
      and(
        eq(t.companyModules.companyId, project.companyId),
        eq(t.companyModules.moduleKey, "vendor-management"),
        eq(t.companyModules.optedIn, true),
      ),
    )
    .get();
  if (vendor) template.vendor = VENDOR_CHECKLIST_LABELS;
  return template;
}
