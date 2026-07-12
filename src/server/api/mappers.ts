import { asc, desc, eq } from "drizzle-orm";

import type { Company, CompanyModule, ModuleKey, PostSalesProject, PostSalesStep, Project } from "@/types";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

export function mapCompany(row: typeof t.companies.$inferSelect, modules: CompanyModule[]): Company {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    designation: row.designation,
    phone: row.phone,
    email: row.email,
    city: row.city,
    officeAddress: row.officeAddress ?? undefined,
    gstNumber: row.gstNumber ?? undefined,
    billingInfo: row.billingInfo ?? undefined,
    onboardingManagerId: row.onboardingManagerId,
    csmId: row.csmId,
    status: row.status as Company["status"],
    modules,
    agreementDate: row.agreementDate,
    goLiveTarget: row.goLiveTarget,
    planExpiry: row.planExpiry,
    plan: row.plan as Company["plan"],
    health: row.health as Company["health"],
    renewedAt: row.renewedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loadCompanyModules(companyId: string): CompanyModule[] {
  const db = getDb();
  return db
    .select()
    .from(t.companyModules)
    .where(eq(t.companyModules.companyId, companyId))
    .all()
    .map((m) => ({
      moduleKey: m.moduleKey as ModuleKey,
      label: m.label,
      optedIn: m.optedIn,
      optedOnDate: m.optedOnDate ?? undefined,
    }));
}

export function loadCompany(id: string): Company | null {
  const db = getDb();
  const row = db.select().from(t.companies).where(eq(t.companies.id, id)).get();
  if (!row) return null;
  return mapCompany(row, loadCompanyModules(id));
}

export function loadCompanies(): Company[] {
  const db = getDb();
  return db
    .select()
    .from(t.companies)
    .orderBy(asc(t.companies.name))
    .all()
    .map((row) => mapCompany(row, loadCompanyModules(row.id)));
}

export function mapProject(row: typeof t.projects.$inferSelect): Project {
  let otherCharges: Project["otherCharges"] = [];
  let customCharges: string[] = [];
  try {
    otherCharges = JSON.parse(row.otherChargesJson || "[]");
  } catch {
    otherCharges = [];
  }
  try {
    customCharges = JSON.parse(row.customChargesJson || "[]");
  } catch {
    customCharges = [];
  }
  return {
    id: row.id,
    name: row.name,
    companyId: row.companyId,
    type: row.type,
    units: row.units,
    city: row.city,
    rera: row.rera ?? "",
    status: row.status as Project["status"],
    currentStep: row.currentStep,
    goLiveAt: row.goLiveAt ?? undefined,
    address: row.address ?? undefined,
    state: row.state ?? undefined,
    pinCode: row.pinCode ?? undefined,
    totalTowers: row.totalTowers ?? undefined,
    totalFloors: row.totalFloors ?? undefined,
    agreementValue: row.agreementValue ?? undefined,
    otherCharges,
    customCharges,
    logoUrl: row.logoUrl ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loadProjects(companyId?: string): Project[] {
  const db = getDb();
  const rows = companyId
    ? db.select().from(t.projects).where(eq(t.projects.companyId, companyId)).orderBy(asc(t.projects.name)).all()
    : db.select().from(t.projects).orderBy(asc(t.projects.name)).all();
  return rows.map(mapProject);
}

export function loadProject(id: string): Project | null {
  const db = getDb();
  const row = db.select().from(t.projects).where(eq(t.projects.id, id)).get();
  return row ? mapProject(row) : null;
}

function mapStep(row: typeof t.postSalesSteps.$inferSelect): PostSalesStep {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    requiresTemplate: row.requiresTemplate,
    templateStatus: row.templateStatus as PostSalesStep["templateStatus"],
    templateSentOn: row.templateSentOn ?? undefined,
    uploadStatus: row.uploadStatus as PostSalesStep["uploadStatus"],
    uploadedFile: row.uploadedFileJson ? JSON.parse(row.uploadedFileJson) : undefined,
    approvalStatus: row.approvalStatus as PostSalesStep["approvalStatus"],
    approvedBy: row.approvedBy ?? undefined,
    approvedOn: row.approvedOn ?? undefined,
    remarks: row.remarks ?? undefined,
    order: row.order,
  };
}

export function loadPostSalesProject(id: string): PostSalesProject | null {
  const db = getDb();
  const row = db.select().from(t.postSalesProjects).where(eq(t.postSalesProjects.id, id)).get();
  if (!row) return null;
  const steps = db
    .select()
    .from(t.postSalesSteps)
    .where(eq(t.postSalesSteps.postSalesProjectId, id))
    .orderBy(asc(t.postSalesSteps.order))
    .all()
    .map(mapStep);
  return {
    id: row.id,
    companyId: row.companyId,
    projectNumber: row.projectNumber,
    projectName: row.projectName,
    steps,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loadPostSalesByCompany(companyId: string): PostSalesProject[] {
  const db = getDb();
  return db
    .select()
    .from(t.postSalesProjects)
    .where(eq(t.postSalesProjects.companyId, companyId))
    .orderBy(desc(t.postSalesProjects.createdAt))
    .all()
    .map((row) => loadPostSalesProject(row.id)!)
    .filter(Boolean);
}

export function logActivity(entry: {
  who: string;
  what: string;
  kind: "success" | "info" | "warning" | "danger";
  companyId?: string;
  projectId?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(t.activityEntries)
    .values({
      id: crypto.randomUUID(),
      who: entry.who,
      what: entry.what,
      kind: entry.kind,
      companyId: entry.companyId,
      projectId: entry.projectId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
