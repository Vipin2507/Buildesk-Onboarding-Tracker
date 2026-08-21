import type { CrmAccount } from "@/types/crm-account";
import { newId, nowIso } from "@/types/common";
import { notifyCrmGoLive } from "@/lib/crm-notify";
import {
  deleteCrmAccount as apiDeleteCrmAccount,
  upsertCrmAccount as apiUpsertCrmAccount,
  upsertCrmAccountsBatch as apiUpsertCrmAccountsBatch,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";
import { createStore, touch } from "./persist";

type CrmAccountInput = Omit<CrmAccount, "id" | "createdAt" | "updatedAt"> & { id?: string };

type CrmAccountState = {
  accounts: CrmAccount[];
  hydrateAccounts: (accounts: CrmAccount[]) => void;
  getById: (id: string) => CrmAccount | undefined;
  upsertAccount: (data: CrmAccountInput) => CrmAccount;
  upsertAccountsBatch: (rows: CrmAccountInput[]) => CrmAccount[];
  updateAccount: (id: string, patch: Partial<CrmAccount>) => void;
  markLive: (id: string, who?: string) => void;
  setAccountStatus: (id: string, status: CrmAccount["status"], who?: string) => void;
  deleteAccount: (id: string) => CrmAccount | undefined;
};

function toApiPayload(account: CrmAccount) {
  return {
    id: account.id,
    name: account.name,
    userId: account.userId,
    companyType: account.companyType,
    contact: account.contact,
    phone: account.phone,
    email: account.email,
    city: account.city,
    state: account.state,
    country: account.country,
    region: account.region,
    ownerName: account.ownerName,
    ownerPhone: account.ownerPhone,
    ownerEmail: account.ownerEmail,
    pocName: account.pocName,
    pocMobile: account.pocMobile,
    pocEmail: account.pocEmail,
    salesManagerName: account.salesManagerName,
    accountManagerName: account.accountManagerName,
    supportManager1: account.supportManager1,
    supportManager2: account.supportManager2,
    startDate: account.startDate,
    endDate: account.endDate,
    annualLicense: account.annualLicense,
    dealSize: account.dealSize,
    usersPurchased: account.usersPurchased,
    totalCost: account.totalCost,
    paymentReceived: account.paymentReceived,
    pendingAmount: account.pendingAmount,
    healthScore: account.healthScore,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export const useCrmAccountStore = createStore<CrmAccountState>((set, get) => ({
  accounts: [],

  hydrateAccounts: (accounts) => {
    set({
      accounts: accounts.map((a) =>
        (a.status as string) === "churned" ? { ...a, status: "closed" as const } : a,
      ),
    });
  },

  getById: (id) => get().accounts.find((a) => a.id === id),

  upsertAccount: (data) => {
    const now = nowIso();
    if (data.id && get().getById(data.id)) {
      const updated = touch({ ...get().getById(data.id)!, ...data, updatedAt: now });
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === data.id ? updated : a)),
      }));
      serverSync("crm account", () => apiUpsertCrmAccount({ data: toApiPayload(updated) }));
      return updated;
    }
    const created: CrmAccount = {
      ...data,
      id: data.id ?? newId(),
      status: data.status ?? "onboarding",
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ accounts: [created, ...s.accounts] }));
    serverSync("crm account", () => apiUpsertCrmAccount({ data: toApiPayload(created) }));
    return created;
  },

  upsertAccountsBatch: (rows) => {
    const now = nowIso();
    const byId = new Map(get().accounts.map((a) => [a.id, a]));
    const saved: CrmAccount[] = [];

    for (const data of rows) {
      if (data.id && byId.has(data.id)) {
        const updated = touch({ ...byId.get(data.id)!, ...data, updatedAt: now });
        byId.set(updated.id, updated);
        saved.push(updated);
      } else {
        const created: CrmAccount = {
          ...data,
          id: data.id ?? newId(),
          status: data.status ?? "onboarding",
          createdAt: now,
          updatedAt: now,
        };
        byId.set(created.id, created);
        saved.push(created);
      }
    }

    set({ accounts: [...byId.values()] });
    serverSync("crm accounts batch", () =>
      apiUpsertCrmAccountsBatch({ data: { accounts: saved.map(toApiPayload) } }),
    );
    return saved;
  },

  updateAccount: (id, patch) => {
    const existing = get().getById(id);
    if (!existing) return;
    const updated = touch({ ...existing, ...patch });
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? updated : a)),
    }));
    serverSync("crm account", () => apiUpsertCrmAccount({ data: toApiPayload(updated) }));
  },

  markLive: (id, who) => {
    const existing = get().getById(id);
    if (!existing) return;
    const alreadyLive = existing.status === "live";
    get().updateAccount(id, { status: "live" });
    if (!alreadyLive) {
      notifyCrmGoLive(id, existing.name, who);
    }
  },

  setAccountStatus: (id, status, who) => {
    const existing = get().getById(id);
    if (!existing || existing.status === status) return;
    get().updateAccount(id, { status });
    if (status === "live" && existing.status !== "live") {
      notifyCrmGoLive(id, existing.name, who);
    }
  },

  deleteAccount: (id) => {
    const existing = get().getById(id);
    if (!existing) return undefined;
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    serverSync("delete crm account", () => apiDeleteCrmAccount({ data: { id } }));
    return existing;
  },
}));
