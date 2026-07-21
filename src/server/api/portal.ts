import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { generatePortalSlug } from "@/lib/design-ticket-portal";
import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { CompanyPortalAccess } from "@/types/design-ticket";

function mapPortalRow(row: typeof t.companyPortalAccess.$inferSelect): CompanyPortalAccess {
  return {
    companyId: row.companyId,
    companyName: row.companyName,
    slug: row.slug,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Public — used by client portal routes (no login). */
export const getPortalBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const row = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.slug, data.slug))
      .get();
    if (!row) throw new ApiError(404, "Portal not found");
    return mapPortalRow(row);
  });

export const listCompanyPortalAccess = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  return db.select().from(t.companyPortalAccess).all().map(mapPortalRow);
});

/** Create portal rows for every company that does not have one yet. */
export const ensureCompanyPortals = createServerFn({ method: "POST" }).handler(async () => {
  requireUser();
  const db = getDb();
  const companies = db
    .select({
      id: t.companies.id,
      name: t.companies.name,
      contact: t.companies.contact,
      email: t.companies.email,
    })
    .from(t.companies)
    .all();

  const existing = db.select().from(t.companyPortalAccess).all();
  const byCompany = new Map(existing.map((row) => [row.companyId, row]));
  const usedSlugs = new Set(existing.map((row) => row.slug));
  const now = nowIso();

  for (const company of companies) {
    const current = byCompany.get(company.id);
    if (!current) {
      const slug = generatePortalSlug([...usedSlugs]);
      usedSlugs.add(slug);
      db.insert(t.companyPortalAccess)
        .values({
          companyId: company.id,
          companyName: company.name,
          slug,
          contactName: company.contact || company.name,
          contactEmail: company.email,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      continue;
    }
    if (current.companyName !== company.name) {
      db.update(t.companyPortalAccess)
        .set({ companyName: company.name, updatedAt: now })
        .where(eq(t.companyPortalAccess.companyId, company.id))
        .run();
    }
  }

  return db.select().from(t.companyPortalAccess).all().map(mapPortalRow);
});

const portalAccessSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  slug: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const upsertCompanyPortalAccess = createServerFn({ method: "POST" })
  .validator(portalAccessSchema)
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const existing = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();

    if (existing) {
      db.update(t.companyPortalAccess)
        .set({
          companyName: data.companyName,
          slug: data.slug,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          isActive: data.isActive,
          updatedAt: data.updatedAt,
        })
        .where(eq(t.companyPortalAccess.companyId, data.companyId))
        .run();
    } else {
      db.insert(t.companyPortalAccess)
        .values({
          companyId: data.companyId,
          companyName: data.companyName,
          slug: data.slug,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          isActive: data.isActive,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        })
        .run();
    }

    const row = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();
    if (!row) throw new ApiError(500, "Failed to save portal access");
    return mapPortalRow(row);
  });

export const regenerateCompanyPortalSlug = createServerFn({ method: "POST" })
  .validator(z.object({ companyId: z.string() }))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const current = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();
    if (!current) throw new ApiError(404, "Portal not found");

    const otherSlugs = db
      .select({ slug: t.companyPortalAccess.slug })
      .from(t.companyPortalAccess)
      .all()
      .map((row) => row.slug)
      .filter((slug) => slug !== current.slug);
    const slug = generatePortalSlug(otherSlugs);
    const now = nowIso();

    db.update(t.companyPortalAccess)
      .set({ slug, updatedAt: now })
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .run();

    return mapPortalRow({ ...current, slug, updatedAt: now });
  });

export const setCompanyPortalActive = createServerFn({ method: "POST" })
  .validator(z.object({ companyId: z.string(), isActive: z.boolean() }))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const current = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();
    if (!current) throw new ApiError(404, "Portal not found");
    const now = nowIso();
    db.update(t.companyPortalAccess)
      .set({ isActive: data.isActive, updatedAt: now })
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .run();
    return mapPortalRow({ ...current, isActive: data.isActive, updatedAt: now });
  });

export const updateCompanyPortalContact = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyId: z.string(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      companyName: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const current = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();
    if (!current) throw new ApiError(404, "Portal not found");
    const now = nowIso();
    const patch = {
      contactName: data.contactName ?? current.contactName,
      contactEmail: data.contactEmail ?? current.contactEmail,
      companyName: data.companyName ?? current.companyName,
      updatedAt: now,
    };
    db.update(t.companyPortalAccess)
      .set(patch)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .run();
    return mapPortalRow({ ...current, ...patch });
  });
