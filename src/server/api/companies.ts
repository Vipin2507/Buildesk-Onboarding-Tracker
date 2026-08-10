import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createCompanyModules } from "@/data/module-catalog";
import { requireActiveUserId, requirePermission } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadCompanies, loadCompany, logActivity } from "@/server/api/mappers";
import type { ModuleKey } from "@/types";

type ModuleUpsertRow = {
  moduleKey: string;
  label: string;
  optedIn: boolean;
  optedOnDate?: string | null;
  liveAt?: string | null;
  pocName?: string | null;
  pocMobile?: string | null;
};

/** Keyed upsert by (companyId, moduleKey) — preserves row ids and metadata. */
function upsertCompanyModules(companyId: string, modules: ModuleUpsertRow[], now: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(t.companyModules)
    .where(eq(t.companyModules.companyId, companyId))
    .all();
  const byKey = new Map(existing.map((m) => [m.moduleKey, m]));
  const keep = new Set(modules.map((m) => m.moduleKey));

  for (const m of modules) {
    const prev = byKey.get(m.moduleKey);
    if (prev) {
      db.update(t.companyModules)
        .set({
          label: m.label,
          optedIn: m.optedIn,
          optedOnDate: m.optedOnDate ?? prev.optedOnDate,
          liveAt: m.liveAt !== undefined ? m.liveAt : prev.liveAt,
          pocName: m.pocName !== undefined ? m.pocName : prev.pocName,
          pocMobile: m.pocMobile !== undefined ? m.pocMobile : prev.pocMobile,
        })
        .where(eq(t.companyModules.id, prev.id))
        .run();
    } else {
      db.insert(t.companyModules)
        .values({
          id: newId(),
          companyId,
          moduleKey: m.moduleKey,
          label: m.label,
          optedIn: m.optedIn,
          optedOnDate: m.optedOnDate ?? null,
          liveAt: m.liveAt ?? null,
          pocName: m.pocName ?? null,
          pocMobile: m.pocMobile ?? null,
        })
        .run();
    }

    // Keep a compatibility subscription row in sync with opt-in (does not overwrite validity).
    try {
      const sub = db
        .select()
        .from(t.moduleSubscriptions)
        .where(
          and(
            eq(t.moduleSubscriptions.companyId, companyId),
            eq(t.moduleSubscriptions.moduleKey, m.moduleKey),
          ),
        )
        .get();
      if (!sub) {
        db.insert(t.moduleSubscriptions)
          .values({
            id: newId(),
            companyId,
            moduleKey: m.moduleKey,
            status: m.optedIn ? "active" : "inactive",
            startDate: m.optedOnDate || now.slice(0, 10),
            validUntil: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      } else if (m.optedIn && sub.status === "inactive") {
        db.update(t.moduleSubscriptions)
          .set({ status: "active", updatedAt: now })
          .where(eq(t.moduleSubscriptions.id, sub.id))
          .run();
      }
    } catch {
      // module_subscriptions may not exist until db:ensure runs
    }
  }

  for (const prev of existing) {
    if (keep.has(prev.moduleKey)) continue;
    // Soft-disable unknown modules rather than delete (preserve history).
    db.update(t.companyModules)
      .set({ optedIn: false })
      .where(eq(t.companyModules.id, prev.id))
      .run();
  }
}

export const listCompanies = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return loadCompanies();
});

export const getCompany = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const company = loadCompany(data.id);
    if (!company) throw new ApiError(404, "Company not found");
    return company;
  });

const companyInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contact: z.string().min(1),
  designation: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  city: z.string().min(1),
  region: z.enum(["NCR", "South", "West", "Rest of India"]).optional(),
  ownerName: z.string().optional(),
  ownerMobile: z.string().optional(),
  pocName: z.string().optional(),
  pocMobile: z.string().optional(),
  officeAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  billingInfo: z.string().optional(),
  onboardingManagerId: z.string(),
  csmId: z.string(),
  salesAgentId: z.string().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  agreementDate: z.string(),
  startDate: z.string().optional(),
  goLiveTarget: z.string(),
  planExpiry: z.string(),
  plan: z.enum(["Annual", "Half-Yearly", "AMC"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  companyType: z
    .enum(["Real Estate Developer", "Channel Partner", "Broker", "Mandate", "CT", "Agent"])
    .optional()
    .nullable(),
  state: z.string().optional().nullable(),
  supportManager1Id: z.string().optional().nullable(),
  supportManager2Id: z.string().optional().nullable(),
  additionalSupportContactIds: z.array(z.string()).optional().nullable(),
  annualLicense: z.boolean().optional().nullable(),
  dealSize: z.number().optional().nullable(),
  usersPurchased: z.number().optional().nullable(),
  totalCost: z.number().optional().nullable(),
  paymentReceived: z.number().optional().nullable(),
  pendingAmount: z.number().optional().nullable(),
  endDate: z.string().optional().nullable(),
  paymentHistory: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        amount: z.number(),
        note: z.string().optional(),
        method: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
  moduleKeys: z.array(z.string()).optional(),
  modules: z
    .array(
      z.object({
        moduleKey: z.string(),
        label: z.string(),
        optedIn: z.boolean(),
        optedOnDate: z.string().optional(),
        liveAt: z.string().optional().nullable(),
        pocName: z.string().optional().nullable(),
        pocMobile: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export const createCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => companyInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    if (data.salesAgentId) {
      requirePermission("assignSalesAgent");
      requireActiveUserId(data.salesAgentId, "Sales agent");
    }
    const db = getDb();
    const id = data.id ?? newId();
    const already = loadCompany(id);
    if (already) return already;
    const now = nowIso();
    const moduleKeys = (data.moduleKeys ?? ["post-sales"]) as ModuleKey[];
    db.insert(t.companies)
      .values({
        id,
        name: data.name,
        contact: data.contact,
        designation: data.designation,
        phone: data.phone,
        email: data.email,
        city: data.city,
        region: data.region ?? "Rest of India",
        ownerName: data.ownerName ?? "",
        ownerMobile: data.ownerMobile ?? "",
        pocName: data.pocName || data.contact,
        pocMobile: data.pocMobile || data.phone,
        officeAddress: data.officeAddress,
        gstNumber: data.gstNumber,
        billingInfo: data.billingInfo,
        onboardingManagerId: data.onboardingManagerId,
        csmId: data.csmId,
        salesAgentId: data.salesAgentId || null,
        status: data.status,
        agreementDate: data.agreementDate,
        startDate: data.startDate || data.agreementDate,
        goLiveTarget: data.goLiveTarget,
        planExpiry: data.planExpiry,
        plan: data.plan,
        health: data.health,
        companyType: data.companyType || null,
        state: data.state || null,
        supportManager1Id: data.supportManager1Id || null,
        supportManager2Id: data.supportManager2Id || null,
        additionalSupportContactIdsJson: data.additionalSupportContactIds
          ? JSON.stringify(data.additionalSupportContactIds)
          : null,
        annualLicense: data.annualLicense ?? null,
        dealSize: data.dealSize != null ? String(data.dealSize) : null,
        usersPurchased: data.usersPurchased ?? null,
        totalCost: data.totalCost != null ? String(data.totalCost) : null,
        paymentReceived: data.paymentReceived != null ? String(data.paymentReceived) : null,
        pendingAmount: data.pendingAmount != null ? String(data.pendingAmount) : null,
        endDate: data.endDate || null,
        paymentHistoryJson: data.paymentHistory ? JSON.stringify(data.paymentHistory) : null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const modules =
      data.modules ??
      createCompanyModules(moduleKeys, now.slice(0, 10)).map((m) => ({
        moduleKey: m.moduleKey,
        label: m.label,
        optedIn: m.optedIn,
        optedOnDate: m.optedOnDate,
        liveAt: m.liveAt,
        pocName: m.pocName,
        pocMobile: m.pocMobile,
      }));
    upsertCompanyModules(id, modules, now);
    logActivity({ who: user.name, what: `Created company ${data.name}`, kind: "success", companyId: id });
    return loadCompany(id)!;
  });

export const updateCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: companyInput.partial().extend({
          renewedAt: z.string().optional().nullable(),
          modules: z
            .array(
              z.object({
                moduleKey: z.string(),
                label: z.string(),
                optedIn: z.boolean(),
                optedOnDate: z.string().optional(),
                liveAt: z.string().optional().nullable(),
                pocName: z.string().optional().nullable(),
                pocMobile: z.string().optional().nullable(),
              }),
            )
            .optional(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const existing = loadCompany(data.id);
    if (!existing) throw new ApiError(404, "Company not found");
    const { modules, moduleKeys: _mk, salesAgentId, ...rest } = data.patch as typeof data.patch & {
      moduleKeys?: string[];
    };
    if (salesAgentId !== undefined && salesAgentId !== (existing.salesAgentId ?? null)) {
      requirePermission("assignSalesAgent");
      requireActiveUserId(salesAgentId, "Sales agent");
    }
    const {
      additionalSupportContactIds,
      paymentHistory,
      dealSize,
      totalCost,
      paymentReceived,
      pendingAmount,
      ...scalarRest
    } = rest as typeof rest & {
      additionalSupportContactIds?: string[] | null;
      paymentHistory?: unknown;
      dealSize?: number | null;
      totalCost?: number | null;
      paymentReceived?: number | null;
      pendingAmount?: number | null;
    };
    const set: Record<string, unknown> = { ...scalarRest, updatedAt: nowIso() };
    if (salesAgentId !== undefined) set.salesAgentId = salesAgentId || null;
    if (additionalSupportContactIds !== undefined) {
      set.additionalSupportContactIdsJson = additionalSupportContactIds
        ? JSON.stringify(additionalSupportContactIds)
        : null;
    }
    if (paymentHistory !== undefined) {
      set.paymentHistoryJson = paymentHistory ? JSON.stringify(paymentHistory) : null;
    }
    if (dealSize !== undefined) set.dealSize = dealSize != null ? String(dealSize) : null;
    if (totalCost !== undefined) set.totalCost = totalCost != null ? String(totalCost) : null;
    if (paymentReceived !== undefined) {
      set.paymentReceived = paymentReceived != null ? String(paymentReceived) : null;
    }
    if (pendingAmount !== undefined) {
      set.pendingAmount = pendingAmount != null ? String(pendingAmount) : null;
    }
    db.update(t.companies)
      .set(set)
      .where(eq(t.companies.id, data.id))
      .run();
    if (modules) {
      upsertCompanyModules(data.id, modules, nowIso());
    }
    logActivity({ who: user.name, what: `Updated company ${existing.name}`, kind: "info", companyId: data.id });
    return loadCompany(data.id)!;
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin"]);
    const existing = loadCompany(data.id);
    if (!existing) return { ok: true as const, skipped: true as const };
    getDb().delete(t.companies).where(eq(t.companies.id, data.id)).run();
    logActivity({ who: user.name, what: `Deleted company ${existing.name}`, kind: "warning", companyId: data.id });
    return { ok: true as const };
  });

export const renewCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), planExpiry: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const existing = loadCompany(data.id);
    if (!existing) throw new ApiError(404, "Company not found");
    const expiry =
      data.planExpiry ??
      new Date(new Date(existing.planExpiry).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    getDb()
      .update(t.companies)
      .set({ planExpiry: expiry, renewedAt: nowIso(), health: "Healthy", updatedAt: nowIso() })
      .where(eq(t.companies.id, data.id))
      .run();
    logActivity({ who: user.name, what: `Renewed ${existing.name}`, kind: "success", companyId: data.id });
    return loadCompany(data.id)!;
  });
