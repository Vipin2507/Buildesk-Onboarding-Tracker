import type { Company, ModuleKey } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createStore, touch } from "./persist";
import { getModuleLabel, normalizeCompanyModules } from "@/data/module-catalog";
import {
  createCompany as apiCreateCompany,
  updateCompany as apiUpdateCompany,
  deleteCompany as apiDeleteCompany,
  renewCompany as apiRenewCompany,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";

type CompanyState = {
  companies: Company[];
  addCompany: (data: Omit<Company, "id" | "createdAt" | "updatedAt">) => Company;
  updateCompany: (id: string, data: Partial<Company>) => void;
  deleteCompany: (id: string) => Company | undefined;
  getById: (id: string) => Company | undefined;
  transferManager: (companyId: string, managerId: string, who: string) => void;
  markRenewed: (id: string) => void;
  enableModule: (companyId: string, moduleKey: ModuleKey) => void;
};

export const useCompanyStore = createStore<CompanyState>((set, get) => ({
  companies: [],

  addCompany: (data) => {
    const now = nowIso();
    const company: Company = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ companies: [company, ...s.companies] }));
    logActivity({ who: "You", what: `Added company ${company.name}`, kind: "success", companyId: company.id });
    serverSync("createCompany", () =>
      apiCreateCompany({
        data: {
          id: company.id,
          name: company.name,
          contact: company.contact,
          designation: company.designation,
          phone: company.phone,
          email: company.email,
          city: company.city,
          officeAddress: company.officeAddress,
          gstNumber: company.gstNumber,
          billingInfo: company.billingInfo,
          onboardingManagerId: company.onboardingManagerId,
          csmId: company.csmId,
          status: company.status,
          agreementDate: company.agreementDate,
          startDate: company.startDate,
          goLiveTarget: company.goLiveTarget,
          planExpiry: company.planExpiry,
          plan: company.plan,
          health: company.health,
          modules: company.modules,
        },
      }),
    );
    return company;
  },

  updateCompany: (id, data) => {
    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? touch({ ...c, ...data }) : c)),
    }));
    const company = get().getById(id);
    if (company) {
      logActivity({ who: "You", what: `Updated company ${company.name}`, kind: "info", companyId: id });
      serverSync("updateCompany", () =>
        apiUpdateCompany({
          data: {
            id,
            patch: {
              ...data,
              modules: data.modules ?? company.modules,
            },
          },
        }),
      );
    }
  },

  deleteCompany: (id) => {
    const company = get().getById(id);
    if (!company) return undefined;
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
    logActivity({ who: "You", what: `Deleted company ${company.name}`, kind: "warning", companyId: id });
    serverSync("deleteCompany", () => apiDeleteCompany({ data: { id } }));
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
    serverSync("transferManager", () =>
      apiUpdateCompany({ data: { id: companyId, patch: { onboardingManagerId: managerId } } }),
    );
  },

  markRenewed: (id) => {
    const now = nowIso();
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === id
          ? touch({
              ...c,
              renewedAt: now,
              planExpiry: expiry,
            })
          : c,
      ),
    }));
    const company = get().getById(id);
    if (company) {
      logActivity({ who: "You", what: `Renewed plan for ${company.name}`, kind: "success", companyId: id });
    }
    serverSync("renewCompany", () => apiRenewCompany({ data: { id, planExpiry: expiry } }));
  },

  enableModule: (companyId, moduleKey) => {
    const company = get().getById(companyId);
    if (!company) return;
    const today = new Date().toISOString().slice(0, 10);
    let nextModules = normalizeCompanyModules((company as { modules?: unknown }).modules);
    nextModules = nextModules.map((m) =>
      m.moduleKey === moduleKey ? { ...m, optedIn: true, optedOnDate: today } : m,
    );
    set((s) => ({
      companies: s.companies.map((c) => {
        if (c.id !== companyId) return c;
        return touch({ ...c, modules: nextModules });
      }),
    }));
    logActivity({
      who: "You",
      what: `Enabled module ${getModuleLabel(moduleKey)} for ${company.name}`,
      kind: "success",
      companyId,
    });
    serverSync("enableModule", () =>
      apiUpdateCompany({ data: { id: companyId, patch: { modules: nextModules } } }),
    );
  },
}));
