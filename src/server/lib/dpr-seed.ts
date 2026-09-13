import { eq } from "drizzle-orm";

import { DPR_TEMPLATE_SEEDS } from "@/data/dpr-catalog";
import { newId, nowIso } from "@/types";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

/** Idempotent seed for DPR checklist templates (CRM + ERP onboarding). */
export function ensureDprTemplatesSeeded(db: ReturnType<typeof getDb> = getDb()) {
  const now = nowIso();
  for (const tpl of DPR_TEMPLATE_SEEDS) {
    const existing = db.select().from(t.dprTaskTemplates).where(eq(t.dprTaskTemplates.id, tpl.id)).get();
    if (!existing) {
      db.insert(t.dprTaskTemplates)
        .values({
          id: tpl.id,
          category: tpl.category,
          subcategory: tpl.subcategory,
          templateName: tpl.templateName,
          description: tpl.description,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    const steps = db
      .select()
      .from(t.dprTemplateSteps)
      .where(eq(t.dprTemplateSteps.templateId, tpl.id))
      .all();
    if (steps.length === 0) {
      tpl.steps.forEach((stepName, index) => {
        db.insert(t.dprTemplateSteps)
          .values({
            id: newId(),
            templateId: tpl.id,
            stepOrder: index + 1,
            stepName,
          })
          .run();
      });
    }
  }
}
