import type { CrmEvent, ModuleSubscription, ModuleSubscriptionEvent } from "@/types";
import { createStore } from "./persist";
import {
  listModuleSubscriptionEvents as apiListSubEvents,
  upsertModuleSubscription as apiUpsertSub,
} from "@/lib/api";
import { serverSyncWithRollback } from "@/lib/sync";

type CrmState = {
  events: CrmEvent[];
  subscriptions: ModuleSubscription[];
  subscriptionEvents: ModuleSubscriptionEvent[];
  setEvents: (events: CrmEvent[]) => void;
  setSubscriptions: (subscriptions: ModuleSubscription[]) => void;
  setSubscriptionEvents: (events: ModuleSubscriptionEvent[]) => void;
  upsertSubscription: (input: {
    companyId: string;
    moduleKey: string;
    status: ModuleSubscription["status"];
    startDate?: string;
    validUntil?: string | null;
    notes?: string | null;
    reason?: string;
  }) => void;
  getEventsByCompany: (companyId: string) => CrmEvent[];
};

export const useCrmEventStore = createStore<CrmState>((set, get) => ({
  events: [],
  subscriptions: [],
  subscriptionEvents: [],

  setEvents: (events) => set({ events }),
  setSubscriptions: (subscriptions) => set({ subscriptions }),
  setSubscriptionEvents: (subscriptionEvents) => set({ subscriptionEvents }),

  upsertSubscription: (input) => {
    const previous = get().subscriptions;
    const now = new Date().toISOString();
    const existing = previous.find(
      (s) => s.companyId === input.companyId && s.moduleKey === input.moduleKey,
    );
    const optimistic: ModuleSubscription = existing
      ? {
          ...existing,
          status: input.status,
          startDate: input.startDate || existing.startDate,
          validUntil:
            input.validUntil === undefined ? existing.validUntil : input.validUntil ?? undefined,
          notes: input.notes === undefined ? existing.notes : input.notes ?? undefined,
          updatedAt: now,
        }
      : {
          id: `tmp-${input.companyId}-${input.moduleKey}`,
          companyId: input.companyId,
          moduleKey: input.moduleKey as ModuleSubscription["moduleKey"],
          status: input.status,
          startDate: input.startDate || now.slice(0, 10),
          validUntil: input.validUntil ?? undefined,
          notes: input.notes ?? undefined,
          createdAt: now,
          updatedAt: now,
        };

    set((s) => ({
      subscriptions: existing
        ? s.subscriptions.map((x) => (x.id === existing.id ? optimistic : x))
        : [optimistic, ...s.subscriptions],
    }));

    serverSyncWithRollback(
      "upsertModuleSubscription",
      () =>
        apiUpsertSub({ data: input }).then(async (saved) => {
          if (saved) {
            set((s) => ({
              subscriptions: s.subscriptions.some((x) => x.id === saved.id || x.id === optimistic.id)
                ? s.subscriptions.map((x) =>
                    x.id === saved.id || x.id === optimistic.id ? saved : x,
                  )
                : [saved, ...s.subscriptions],
            }));
          }
          try {
            const events = await apiListSubEvents({
              data: { companyId: input.companyId, moduleKey: input.moduleKey },
            });
            set((s) => ({
              subscriptionEvents: [
                ...events,
                ...s.subscriptionEvents.filter(
                  (e) =>
                    !(e.companyId === input.companyId && e.moduleKey === input.moduleKey),
                ),
              ],
            }));
          } catch {
            // History refresh is best-effort; subscription row already saved.
          }
          return saved;
        }),
      () => set({ subscriptions: previous }),
    );
  },

  getEventsByCompany: (companyId) =>
    get()
      .events.filter((e) => e.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
}));
