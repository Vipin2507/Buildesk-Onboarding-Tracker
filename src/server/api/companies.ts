import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createCompanyModules } from "@/data/module-catalog";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadCompanies, loadCompany, logActivity } from "@/server/api/mappers";
import type { ModuleKey } from "@/types";

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
  officeAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  billingInfo: z.string().optional(),
  onboardingManagerId: z.string(),
  csmId: z.string(),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  agreementDate: z.string(),
  startDate: z.string().optional(),
  goLiveTarget: z.string(),
  planExpiry: z.string(),
  plan: z.enum(["Starter", "Growth", "Enterprise"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  moduleKeys: z.array(z.string()).optional(),
  modules: z
    .array(
      z.object({
        moduleKey: z.string(),
        label: z.string(),
        optedIn: z.boolean(),
        optedOnDate: z.string().optional(),
      }),
    )
    .optional(),
});

export const createCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => companyInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const id = data.id ?? newId();
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
        officeAddress: data.officeAddress,
        gstNumber: data.gstNumber,
        billingInfo: data.billingInfo,
        onboardingManagerId: data.onboardingManagerId,
        csmId: data.csmId,
        status: data.status,
        agreementDate: data.agreementDate,
        startDate: data.startDate || data.agreementDate,
        goLiveTarget: data.goLiveTarget,
        planExpiry: data.planExpiry,
        plan: data.plan,
        health: data.health,
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
      }));
    for (const m of modules) {
      db.insert(t.companyModules)
        .values({
          id: newId(),
          companyId: id,
          moduleKey: m.moduleKey,
          label: m.label,
          optedIn: m.optedIn,
          optedOnDate: m.optedOnDate,
        })
        .run();
    }
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
    const { modules, moduleKeys: _mk, ...rest } = data.patch as typeof data.patch & { moduleKeys?: string[] };
    db.update(t.companies)
      .set({ ...rest, updatedAt: nowIso() })
      .where(eq(t.companies.id, data.id))
      .run();
    if (modules) {
      db.delete(t.companyModules).where(eq(t.companyModules.companyId, data.id)).run();
      for (const m of modules) {
        db.insert(t.companyModules)
          .values({
            id: newId(),
            companyId: data.id,
            moduleKey: m.moduleKey,
            label: m.label,
            optedIn: m.optedIn,
            optedOnDate: m.optedOnDate,
          })
          .run();
      }
    }
    logActivity({ who: user.name, what: `Updated company ${existing.name}`, kind: "info", companyId: data.id });
    return loadCompany(data.id)!;
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin"]);
    const existing = loadCompany(data.id);
    if (!existing) throw new ApiError(404, "Company not found");
    getDb().delete(t.companies).where(eq(t.companies.id, data.id)).run();
    logActivity({ who: user.name, what: `Deleted company ${existing.name}`, kind: "warning", companyId: data.id });
    return { ok: true };
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
