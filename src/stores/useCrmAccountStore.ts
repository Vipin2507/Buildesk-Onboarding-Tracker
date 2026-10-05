import { serializeInstallments } from "@/lib/crm-account-commercial";
import type { CrmAccount } from "@/types/crm-account";
import { newId, nowIso } from "@/types/common";
import { notifyCrmGoLive } from "@/lib/crm-notify";
import type { CrmAccountPaymentBulkPatch } from "@/lib/crm-account-payment-sheet-import";
import {
  bulkUpdateCrmAccountPayments as apiBulkUpdateCrmAccountPayments,
  deleteCrmAccount as apiDeleteCrmAccount,
  upsertCrmAccount as apiUpsertCrmAccount,
  upsertCrmAccountsBatch as apiUpsertCrmAccountsBatch,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";
import { toast } from "sonner";
import { createStore, touch } from "./persist";

type CrmAccountInput = Omit<CrmAccount, "id" | "createdAt" | "updatedAt"> & { id?: string };

type CrmAccountState = {
  accounts: CrmAccount[];
  hydrateAccounts: (accounts: CrmAccount[]) => void;
  getById: (id: string) => CrmAccount | undefined;
  upsertAccount: (data: CrmAccountInput) => Promise<CrmAccount>;
  upsertAccountsBatch: (rows: CrmAccountInput[]) => Promise<CrmAccount[]>;
  updateAccount: (id: string, patch: Partial<CrmAccount>) => void;
  markLive: (id: string, who?: string) => void;
  setAccountStatus: (
    id: string,
    status: CrmAccount["status"],
    opts?: { who?: string; statusRemarks?: string },
  ) => void;
  deleteAccount: (id: string) => CrmAccount | undefined;
  bulkUpdatePaymentsFromSheet: (updates: CrmAccountPaymentBulkPatch[]) => Promise<number>;
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
    gstPercent: account.gstPercent,
    usersPurchased: account.usersPurchased,
    valuePerUser: account.valuePerUser,
    totalCost: account.totalCost,
    paymentReceived: account.paymentReceived,
    pendingAmount: account.pendingAmount,
    paymentCycleBaseline: account.paymentCycleBaseline ?? null,
    renewalWindowNotifiedForEndDate: account.renewalWindowNotifiedForEndDate ?? null,
    installmentCount: account.installmentCount,
    installmentsJson:
      account.installments && account.installments.length > 0
        ? serializeInstallments(account.installments)
        : null,
    healthScore: account.healthScore,
    status: account.status,
    statusRemarks: account.statusRemarks ?? null,
    whatsappGroupId: account.whatsappGroupId ?? null,
    whatsappGroupName: account.whatsappGroupName ?? null,
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

  upsertAccount: async (data) => {
    const now = nowIso();
    const previous = data.id ? get().getById(data.id) : undefined;
    if (data.id && previous) {
      const updated = touch({ ...previous, ...data, updatedAt: now });
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === data.id ? updated : a)),
      }));
      try {
        const saved = await apiUpsertCrmAccount({ data: toApiPayload(updated) });
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === saved.id ? saved : a)),
        }));
        return saved;
      } catch (e) {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === previous.id ? previous : a)),
        }));
        const message = e instanceof Error ? e.message : "Failed to save account";
        toast.error(message, { description: "Account changes were not saved." });
        throw e;
      }
    }
    const created: CrmAccount = {
      ...data,
      id: data.id ?? newId(),
      status: data.status ?? "onboarding",
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ accounts: [created, ...s.accounts] }));
    try {
      const saved = await apiUpsertCrmAccount({ data: toApiPayload(created) });
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === created.id ? saved : a)),
      }));
      return saved;
    } catch (e) {
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== created.id) }));
      const message = e instanceof Error ? e.message : "Failed to save account";
      toast.error(message, { description: "Account was not saved." });
      throw e;
    }
  },

  upsertAccountsBatch: async (rows) => {
    const now = nowIso();
    const previousAccounts = get().accounts;
    const byId = new Map(previousAccounts.map((a) => [a.id, a]));
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
    try {
      const remote = await apiUpsertCrmAccountsBatch({
        data: { accounts: saved.map(toApiPayload) },
      });
      if (remote.length > 0) {
        const next = new Map(get().accounts.map((a) => [a.id, a]));
        for (const account of remote) next.set(account.id, account);
        set({ accounts: [...next.values()] });
        return remote;
      }
      return saved;
    } catch (e) {
      set({ accounts: previousAccounts });
      const message = e instanceof Error ? e.message : "Failed to save accounts";
      toast.error(message, { description: "Account import was not saved." });
      throw e;
    }
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

  setAccountStatus: (id, status, opts) => {
    const existing = get().getById(id);
    if (!existing || existing.status === status) return;

    const patch: Partial<CrmAccount> = { status };
    if (status === "suspended" || status === "inactive") {
      patch.statusRemarks = opts?.statusRemarks?.trim() || undefined;
    } else {
      patch.statusRemarks = undefined;
    }

    get().updateAccount(id, patch);
    if (status === "live" && existing.status !== "live") {
      notifyCrmGoLive(id, existing.name, opts?.who);
    }
  },

  deleteAccount: (id) => {
    const existing = get().getById(id);
    if (!existing) return undefined;
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    serverSync("delete crm account", () => apiDeleteCrmAccount({ data: { id } }));
    return existing;
  },

  bulkUpdatePaymentsFromSheet: async (updates) => {
    const res = await apiBulkUpdateCrmAccountPayments({ data: { updates } });
    const byId = new Map(get().accounts.map((a) => [a.id, a]));
    for (const account of res.accounts) {
      byId.set(account.id, account);
    }
    set({ accounts: [...byId.values()] });
    return res.updated;
  },
}));
