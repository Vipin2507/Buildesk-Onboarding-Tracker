import { and, eq } from "drizzle-orm";

import { CHECKLIST_TEMPLATE, VENDOR_CHECKLIST_LABELS } from "@/data/constants";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

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
