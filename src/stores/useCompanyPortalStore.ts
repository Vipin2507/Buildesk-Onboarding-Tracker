import type { Company } from "@/types";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { nowIso } from "@/types";
import {
  regenerateCompanyPortalSlug,
  setCompanyPortalActive,
  updateCompanyPortalContact,
  updateCompanyPortalSlug,
  upsertCompanyPortalAccess,
} from "@/lib/api";
import { generatePortalSlug, isValidPortalSlug, normalizePortalSlug } from "@/lib/design-ticket-portal";
import { serverSync } from "@/lib/sync";
import { createPersistedStore, touch } from "./persist";

type CompanyPortalState = {
  access: CompanyPortalAccess[];
  hydrateAccess: (records: CompanyPortalAccess[]) => void;
  mergeAccess: (record: CompanyPortalAccess) => void;
  generateAccessForCompany: (
    company: Pick<Company, "id" | "name" | "contact" | "email">,
    opts?: { slug?: string },
  ) => CompanyPortalAccess;
  ensureAllCompanies: (companies: Company[]) => void;
  regenerateSlug: (companyId: string) => string | undefined;
  updateSlug: (
    companyId: string,
    slugInput: string,
  ) => { ok: true; slug: string; unchanged?: boolean } | { ok: false; error: string };
  setActive: (companyId: string, isActive: boolean) => void;
  updateContact: (
    companyId: string,
    data: Partial<Pick<CompanyPortalAccess, "contactName" | "contactEmail" | "companyName">>,
  ) => void;
  getBySlug: (slug: string) => CompanyPortalAccess | undefined;
  getByCompanyId: (companyId: string) => CompanyPortalAccess | undefined;
};

function syncPortal(record: CompanyPortalAccess) {
  serverSync("portal access", () => upsertCompanyPortalAccess({ data: record }));
}

export const useCompanyPortalStore = createPersistedStore<CompanyPortalState>(
  "company-portal-v1",
  (set, get) => ({
    access: [],

    hydrateAccess: (records) => {
      set((s) => {
        const serverIds = new Set(records.map((r) => r.companyId));
        // Keep local-only rows (e.g. CRM portals mid-sync) until the server has them.
        const localOnly = s.access.filter((a) => !serverIds.has(a.companyId));
        return { access: [...records, ...localOnly] };
      });
    },

    mergeAccess: (record) => {
      set((s) => {
        const idx = s.access.findIndex((a) => a.companyId === record.companyId);
        if (idx === -1) return { access: [...s.access, record] };
        const next = [...s.access];
        next[idx] = record;
        return { access: next };
      });
    },

    generateAccessForCompany: (company, opts) => {
      const existing = get().getByCompanyId(company.id);
      if (existing) {
        if (existing.companyName !== company.name) {
          get().updateContact(company.id, { companyName: company.name });
          return get().getByCompanyId(company.id)!;
        }
        // Do not re-POST existing portals on every page load — that floods the
        // reverse proxy and surfaces as net::ERR_FAILED / Failed to fetch.
        return existing;
      }

      const now = nowIso();
      const taken = new Set(get().access.map((a) => a.slug));
      const requested = opts?.slug ? normalizePortalSlug(opts.slug) : "";
      const slug = requested || generatePortalSlug([...taken]);
      const record: CompanyPortalAccess = {
        companyId: company.id,
        companyName: company.name,
        slug,
        contactName: company.contact || company.name,
        contactEmail: company.email,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      set((s) => ({ access: [...s.access, record] }));
      syncPortal(record);
      return record;
    },

    ensureAllCompanies: (companies) => {
      for (const company of companies) {
        get().generateAccessForCompany(company);
      }
      const ids = new Set(companies.map((c) => c.id));
      set((s) => ({
        access: s.access.map((a) => {
          const company = companies.find((c) => c.id === a.companyId);
          if (!company || !ids.has(a.companyId)) return a;
          if (a.companyName === company.name) return a;
          return touch({ ...a, companyName: company.name });
        }),
      }));
    },

    regenerateSlug: (companyId) => {
      const current = get().getByCompanyId(companyId);
      if (!current) return undefined;
      const slug = generatePortalSlug(
        get().access.filter((a) => a.companyId !== companyId).map((a) => a.slug),
      );
      const updated = touch({ ...current, slug });
      set((s) => ({
        access: s.access.map((a) => (a.companyId === companyId ? updated : a)),
      }));
      serverSync("regenerate portal slug", async () => {
        const remote = await regenerateCompanyPortalSlug({ data: { companyId } });
        get().mergeAccess(remote);
        return remote;
      });
      return slug;
    },

    updateSlug: (companyId, slugInput) => {
      const current = get().getByCompanyId(companyId);
      if (!current) return { ok: false, error: "Portal not found" };

      const slug = normalizePortalSlug(slugInput);
      if (!slug) return { ok: false, error: "Portal API key is required" };
      if (!isValidPortalSlug(slug)) {
        return {
          ok: false,
          error: "Portal API key must be 3–48 characters (letters, numbers, hyphens)",
        };
      }
      const taken = get().access.find((a) => a.slug === slug && a.companyId !== companyId);
      if (taken) return { ok: false, error: "This portal API key is already in use" };
      if (slug === current.slug) return { ok: true, slug, unchanged: true };

      const updated = touch({ ...current, slug });
      set((s) => ({
        access: s.access.map((a) => (a.companyId === companyId ? updated : a)),
      }));
      serverSync("update portal slug", async () => {
        const remote = await updateCompanyPortalSlug({ data: { companyId, slug: slugInput } });
        get().mergeAccess(remote);
        return remote;
      });
      return { ok: true, slug };
    },

    setActive: (companyId, isActive) => {
      set((s) => ({
        access: s.access.map((a) =>
          a.companyId === companyId ? touch({ ...a, isActive }) : a,
        ),
      }));
      serverSync("portal active", () =>
        setCompanyPortalActive({ data: { companyId, isActive } }).then((record) => {
          get().mergeAccess(record);
        }),
      );
    },

    updateContact: (companyId, data) => {
      set((s) => ({
        access: s.access.map((a) =>
          a.companyId === companyId ? touch({ ...a, ...data }) : a,
        ),
      }));
      serverSync("portal contact", () =>
        updateCompanyPortalContact({ data: { companyId, ...data } }).then((record) => {
          get().mergeAccess(record);
        }),
      );
    },

    getBySlug: (slug) => get().access.find((a) => a.slug === slug),

    getByCompanyId: (companyId) => get().access.find((a) => a.companyId === companyId),
  }),
);
