import type { Company } from "@/types";
import { newId, nowIso } from "@/types";
import { seedCompanies } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type CompanyState = {
  companies: Company[];
  addCompany: (data: Omit<Company, "id" | "createdAt" | "updatedAt">) => Company;
  updateCompany: (id: string, data: Partial<Company>) => void;
  deleteCompany: (id: string) => Company | undefined;
  getById: (id: string) => Company | undefined;
  transferManager: (companyId: string, managerId: string, who: string) => void;
  markRenewed: (id: string) => void;
};

export const useCompanyStore = createPersistedStore<CompanyState>("companies", (set, get) => ({
  companies: seedCompanies,

  addCompany: (data) => {
    const now = nowIso();
    const company: Company = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ companies: [company, ...s.companies] }));
    logActivity({ who: "You", what: `Added company ${company.name}`, kind: "success", companyId: company.id });
    return company;
  },

  updateCompany: (id, data) => {
    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? touch({ ...c, ...data }) : c)),
    }));
    const company = get().getById(id);
    if (company) {
      logActivity({ who: "You", what: `Updated company ${company.name}`, kind: "info", companyId: id });
    }
  },

  deleteCompany: (id) => {
    const company = get().getById(id);
    if (!company) return undefined;
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
    logActivity({ who: "You", what: `Deleted company ${company.name}`, kind: "warning", companyId: id });
    return company;
  },

  getById: (id) => get().companies.find((c) => c.id === id),

  transferManager: (companyId, managerId, who) => {
    const company = get().getById(companyId);
    if (!company) return;
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId ? touch({ ...c, onboardingManagerId: managerId }) : c,
      ),
    }));
    logActivity({
      who,
      what: `Transferred onboarding manager for ${company.name}`,
      kind: "info",
      companyId,
    });
  },

  markRenewed: (id) => {
    const now = nowIso();
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === id
          ? touch({
              ...c,
              renewedAt: now,
              planExpiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            })
          : c,
      ),
    }));
    const company = get().getById(id);
    if (company) {
      logActivity({ who: "You", what: `Renewed plan for ${company.name}`, kind: "success", companyId: id });
    }
  },
}));
