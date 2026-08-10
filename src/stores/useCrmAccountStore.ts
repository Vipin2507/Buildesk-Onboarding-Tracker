import type { CrmAccount } from "@/types/crm-account";
import { newId, nowIso } from "@/types/common";
import { notifyCrmGoLive } from "@/lib/crm-notify";
import { createPersistedStore, touch } from "./persist";
import { seedCrmAccounts } from "@/data/crm-accounts";

type CrmAccountState = {
  accounts: CrmAccount[];
  getById: (id: string) => CrmAccount | undefined;
  upsertAccount: (data: Omit<CrmAccount, "id" | "createdAt" | "updatedAt"> & { id?: string }) => CrmAccount;
  updateAccount: (id: string, patch: Partial<CrmAccount>) => void;
  markLive: (id: string, who?: string) => void;
  deleteAccount: (id: string) => CrmAccount | undefined;
};

export const useCrmAccountStore = createPersistedStore<CrmAccountState>(
  "crm-accounts-v1",
  (set, get) => ({
    accounts: seedCrmAccounts,

    getById: (id) => get().accounts.find((a) => a.id === id),

    upsertAccount: (data) => {
      const now = nowIso();
      if (data.id && get().getById(data.id)) {
        const updated = touch({ ...get().getById(data.id)!, ...data, updatedAt: now });
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === data.id ? updated : a)),
        }));
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
      return created;
    },

    updateAccount: (id, patch) => {
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === id ? touch({ ...a, ...patch }) : a)),
      }));
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

    deleteAccount: (id) => {
      const existing = get().getById(id);
      if (!existing) return undefined;
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      return existing;
    },
  }),
);

/** Migrate legacy `churned` status to `closed` after localStorage hydrate. */
if (typeof window !== "undefined") {
  useCrmAccountStore.persist.onFinishHydration(() => {
    const { accounts } = useCrmAccountStore.getState();
    if (!accounts.some((a) => (a.status as string) === "churned")) return;
    useCrmAccountStore.setState({
      accounts: accounts.map((a) =>
        (a.status as string) === "churned" ? { ...a, status: "closed" as const } : a,
      ),
    });
  });
}
