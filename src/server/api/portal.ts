import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  CRM_ACCOUNT_COMPANY_MARKER,
  generatePortalSlug,
  isValidPortalSlug,
  normalizePortalSlug,
} from "@/lib/design-ticket-portal";
import { formatPortalSlugInUseMessage, type PortalSlugOwner } from "@/lib/portal-slug-conflict";
import {
  isSameCrmAccountIdentity,
  normalizeAccountName,
  normalizeClientId,
} from "@/lib/portal-slug-identity";
import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { CompanyPortalAccess } from "@/types/design-ticket";

function resolvePortalSlugOwner(
  db: ReturnType<typeof getDb>,
  companyId: string,
  fallbackName?: string,
): PortalSlugOwner {
  const account = db
    .select({ name: t.crmAccounts.name, userId: t.crmAccounts.userId })
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, companyId))
    .get();
  const portal = db
    .select({ companyName: t.companyPortalAccess.companyName })
    .from(t.companyPortalAccess)
    .where(eq(t.companyPortalAccess.companyId, companyId))
    .get();

  const company = db
    .select({ name: t.companies.name })
    .from(t.companies)
    .where(eq(t.companies.id, companyId))
    .get();

  const companyName =
    account?.name?.trim() ||
    portal?.companyName?.trim() ||
    fallbackName?.trim() ||
    company?.name?.trim() ||
    `account ${companyId.slice(0, 8)}…`;

  return {
    companyId,
    companyName,
    clientId: account?.userId ?? undefined,
  };
}

function lookupCrmAccountIdentity(db: ReturnType<typeof getDb>, companyId: string) {
  return db
    .select({ name: t.crmAccounts.name, userId: t.crmAccounts.userId })
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, companyId))
    .get();
}

function deletePortalForCompany(db: ReturnType<typeof getDb>, companyId: string) {
  db.delete(t.companyPortalAccess)
    .where(eq(t.companyPortalAccess.companyId, companyId))
    .run();
}

type PortalTargetHints = {
  companyName?: string;
  userId?: string | null;
};

/** Drop stale portal rows left on an old account id after duplicate CRM imports. */
function removeOrphanPortalsForSameClient(
  db: ReturnType<typeof getDb>,
  targetCompanyId: string,
  hints?: PortalTargetHints,
) {
  const target = lookupCrmAccountIdentity(db, targetCompanyId);
  const clientId = normalizeClientId(target?.userId ?? hints?.userId);
  const targetName = normalizeAccountName(target?.name ?? hints?.companyName);

  const accounts = db
    .select({ id: t.crmAccounts.id, name: t.crmAccounts.name, userId: t.crmAccounts.userId })
    .from(t.crmAccounts)
    .all();

  for (const row of accounts) {
    if (row.id === targetCompanyId) continue;
    const sameClient = Boolean(clientId && normalizeClientId(row.userId) === clientId);
    const sameName = Boolean(targetName && normalizeAccountName(row.name) === targetName);
    if (sameClient || sameName) {
      deletePortalForCompany(db, row.id);
    }
  }

  if (!targetName) return;

  const portals = db
    .select({
      companyId: t.companyPortalAccess.companyId,
      companyName: t.companyPortalAccess.companyName,
    })
    .from(t.companyPortalAccess)
    .all();
  const accountIds = new Set(accounts.map((row) => row.id));

  for (const portal of portals) {
    if (portal.companyId === targetCompanyId) continue;
    if (accountIds.has(portal.companyId)) continue;
    if (normalizeAccountName(portal.companyName) === targetName) {
      deletePortalForCompany(db, portal.companyId);
    }
  }
}

function assertPortalSlugAvailable(
  db: ReturnType<typeof getDb>,
  slug: string,
  excludeCompanyId: string,
  targetHints?: PortalTargetHints,
) {
  const taken = db
    .select({
      companyId: t.companyPortalAccess.companyId,
      companyName: t.companyPortalAccess.companyName,
    })
    .from(t.companyPortalAccess)
    .where(eq(t.companyPortalAccess.slug, slug))
    .get();
  if (taken && taken.companyId !== excludeCompanyId) {
    if (
      isSameCrmAccountIdentity(
        taken.companyId,
        excludeCompanyId,
        (id) => lookupCrmAccountIdentity(db, id),
        {
          ownerPortalCompanyName: taken.companyName,
          targetCompanyName: targetHints?.companyName,
          targetClientId: targetHints?.userId,
        },
      )
    ) {
      deletePortalForCompany(db, taken.companyId);
      return;
    }
    const owner = resolvePortalSlugOwner(db, taken.companyId, taken.companyName);
    throw new ApiError(409, formatPortalSlugInUseMessage(slug, owner));
  }
}

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

/**
 * Portal access FKs to companies.id. CRM accounts live client-side, so ensure a
 * minimal company stub exists before writing portal rows (and design tickets).
 */
function ensureCompanyRowForPortal(access: CompanyPortalAccess) {
  const db = getDb();
  const existing = db
    .select({ id: t.companies.id })
    .from(t.companies)
    .where(eq(t.companies.id, access.companyId))
    .get();
  if (existing) return;

  const now = nowIso();
  const day = now.slice(0, 10);
  const email =
    access.contactEmail?.includes("@") ? access.contactEmail : "portal@buildesk.local";

  db.insert(t.companies)
    .values({
      id: access.companyId,
      name: access.companyName || "CRM Account",
      contact: access.contactName || access.companyName || "Client",
      designation: "CRM Account",
      phone: "—",
      email,
      city: "—",
      region: "Rest of India",
      ownerName: "",
      ownerMobile: "",
      pocName: access.contactName || "",
      pocMobile: "",
      billingInfo: CRM_ACCOUNT_COMPANY_MARKER,
      onboardingManagerId: "crm-portal",
      csmId: "crm-portal",
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

/** Public — used by client portal routes (no login). */
export const getPortalBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
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
  /** Client ID hint for reclaiming stale portal rows; not persisted on portal access. */
  clientUserId: z.string().nullable().optional(),
});

export const upsertCompanyPortalAccess = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => portalAccessSchema.parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const { clientUserId, ...portalData } = data;
    const targetHints: PortalTargetHints = {
      companyName: portalData.companyName,
      userId: clientUserId,
    };
    ensureCompanyRowForPortal(portalData);
    const db = getDb();
    removeOrphanPortalsForSameClient(db, portalData.companyId, targetHints);

    const existing = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, portalData.companyId))
      .get();

    assertPortalSlugAvailable(db, portalData.slug, portalData.companyId, targetHints);

    if (existing) {
      db.update(t.companyPortalAccess)
        .set({
          companyName: portalData.companyName,
          slug: portalData.slug,
          contactName: portalData.contactName,
          contactEmail: portalData.contactEmail,
          isActive: portalData.isActive,
          updatedAt: portalData.updatedAt,
        })
        .where(eq(t.companyPortalAccess.companyId, portalData.companyId))
        .run();
    } else {
      db.insert(t.companyPortalAccess)
        .values({
          companyId: portalData.companyId,
          companyName: portalData.companyName,
          slug: portalData.slug,
          contactName: portalData.contactName,
          contactEmail: portalData.contactEmail,
          isActive: portalData.isActive,
          createdAt: portalData.createdAt,
          updatedAt: portalData.updatedAt,
        })
        .run();
    }

    const row = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, portalData.companyId))
      .get();
    if (!row) throw new ApiError(500, "Failed to save portal access");
    return mapPortalRow(row);
  });

export const regenerateCompanyPortalSlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string() }).parse(data))
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

export const updateCompanyPortalSlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string(), slug: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const slug = normalizePortalSlug(data.slug);
    if (!slug) throw new ApiError(400, "Portal API key is required");
    if (!isValidPortalSlug(slug)) {
      throw new ApiError(400, "Portal API key must be 3–48 characters (letters, numbers, hyphens)");
    }

    const db = getDb();
    const current = db
      .select()
      .from(t.companyPortalAccess)
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .get();
    if (!current) throw new ApiError(404, "Portal not found");
    if (current.slug === slug) return mapPortalRow(current);

    const targetAccount = lookupCrmAccountIdentity(db, data.companyId);
    const targetHints: PortalTargetHints = {
      companyName: current.companyName,
      userId: targetAccount?.userId,
    };
    removeOrphanPortalsForSameClient(db, data.companyId, targetHints);
    assertPortalSlugAvailable(db, slug, data.companyId, targetHints);

    const now = nowIso();
    db.update(t.companyPortalAccess)
      .set({ slug, updatedAt: now })
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .run();

    return mapPortalRow({ ...current, slug, updatedAt: now });
  });

export const setCompanyPortalActive = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string(), isActive: z.boolean() }).parse(data),
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
    db.update(t.companyPortalAccess)
      .set({ isActive: data.isActive, updatedAt: now })
      .where(eq(t.companyPortalAccess.companyId, data.companyId))
      .run();
    return mapPortalRow({ ...current, isActive: data.isActive, updatedAt: now });
  });

export const updateCompanyPortalContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        companyName: z.string().optional(),
      })
      .parse(data),
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
