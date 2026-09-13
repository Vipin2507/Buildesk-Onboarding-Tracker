import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { DprEntry, DprTaskTemplate } from "@/types/dpr";

export function mapDprEntryRow(
  row: typeof t.dprEntries.$inferSelect,
  names?: { executiveName?: string; assignedToName?: string; clientDisplayName?: string },
): DprEntry {
  return {
    id: row.id,
    executiveId: row.executiveId,
    executiveName: names?.executiveName,
    entryDate: row.entryDate,
    category: row.category,
    subcategory: row.subcategory,
    clientId: row.clientId,
    clientNameFreeText: row.clientNameFreeText,
    clientDisplayName: names?.clientDisplayName,
    taskName: row.taskName,
    taskDescription: row.taskDescription,
    assignedTo: row.assignedTo,
    assignedToName: names?.assignedToName,
    status: row.status as DprEntry["status"],
    priority: row.priority as DprEntry["priority"],
    startTime: row.startTime,
    endTime: row.endTime,
    remarks: row.remarks,
    pendingReason: row.pendingReason,
    nextFollowUpDate: row.nextFollowUpDate,
    completionDate: row.completionDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function hydrateDprEntries(rows: typeof t.dprEntries.$inferSelect[]): DprEntry[] {
  const db = getDb();
  const userName = (id: string | null | undefined) => {
    if (!id) return undefined;
    return db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, id)).get()?.name;
  };
  const companyName = (id: string | null | undefined) => {
    if (!id) return undefined;
    return db.select({ name: t.companies.name }).from(t.companies).where(eq(t.companies.id, id)).get()
      ?.name;
  };
  return rows.map((row) =>
    mapDprEntryRow(row, {
      executiveName: userName(row.executiveId),
      assignedToName: userName(row.assignedTo),
      clientDisplayName: companyName(row.clientId) ?? row.clientNameFreeText ?? undefined,
    }),
  );
}

export function mapDprTemplate(
  tpl: typeof t.dprTaskTemplates.$inferSelect,
  steps: typeof t.dprTemplateSteps.$inferSelect[],
): DprTaskTemplate {
  return {
    id: tpl.id,
    category: tpl.category,
    subcategory: tpl.subcategory,
    templateName: tpl.templateName,
    description: tpl.description,
    steps: steps
      .filter((s) => s.templateId === tpl.id)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((s) => ({
        id: s.id,
        templateId: s.templateId,
        stepOrder: s.stepOrder,
        stepName: s.stepName,
      })),
  };
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isFollowUpOverdue(nextFollowUpDate: string | null, status: string) {
  if (status === "Completed") return false;
  if (!nextFollowUpDate?.trim()) return false;
  return nextFollowUpDate.slice(0, 10) < todayIsoDate();
}
