import type { Company } from "@/types";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { nowIso } from "@/types";
import { generatePortalSlug } from "@/lib/design-ticket-portal";
import { createPersistedStore, touch } from "./persist";

type CompanyPortalState = {
  access: CompanyPortalAccess[];
  generateAccessForCompany: (
    company: Pick<Company, "id" | "name" | "contact" | "email">,
  ) => CompanyPortalAccess;
  ensureAllCompanies: (companies: Company[]) => void;
  regenerateSlug: (companyId: string) => string | undefined;
  setActive: (companyId: string, isActive: boolean) => void;
  updateContact: (
    companyId: string,
    data: Partial<Pick<CompanyPortalAccess, "contactName" | "contactEmail" | "companyName">>,
  ) => void;
  getBySlug: (slug: string) => CompanyPortalAccess | undefined;
  getByCompanyId: (companyId: string) => CompanyPortalAccess | undefined;
};

export const useCompanyPortalStore = createPersistedStore<CompanyPortalState>(
  "company-portal-v1",
  (set, get) => ({
    access: [],

    generateAccessForCompany: (company) => {
      const existing = get().getByCompanyId(company.id);
      if (existing) {
        if (existing.companyName !== company.name) {
          get().updateContact(company.id, { companyName: company.name });
        }
        return get().getByCompanyId(company.id)!;
      }

      const now = nowIso();
      const slug = generatePortalSlug(get().access.map((a) => a.slug));
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
      set((s) => ({
        access: s.access.map((a) =>
          a.companyId === companyId ? touch({ ...a, slug }) : a,
        ),
      }));
      return slug;
    },

    setActive: (companyId, isActive) => {
      set((s) => ({
        access: s.access.map((a) =>
          a.companyId === companyId ? touch({ ...a, isActive }) : a,
        ),
      }));
    },

    updateContact: (companyId, data) => {
      set((s) => ({
        access: s.access.map((a) =>
          a.companyId === companyId ? touch({ ...a, ...data }) : a,
        ),
      }));
    },

    getBySlug: (slug) => get().access.find((a) => a.slug === slug),

    getByCompanyId: (companyId) => get().access.find((a) => a.companyId === companyId),
  }),
);
