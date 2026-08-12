import { create } from "zustand";

export type CrmDashboardSyncPhase = "idle" | "initial" | "refreshing";

type State = {
  phase: CrmDashboardSyncPhase;
  hasHydrated: boolean;
  beginSync: () => void;
  endSync: () => void;
  reset: () => void;
};

export const useCrmDashboardSyncStore = create<State>((set, get) => ({
  phase: "initial",
  hasHydrated: false,

  beginSync: () =>
    set({
      phase: get().hasHydrated ? "refreshing" : "initial",
    }),

  endSync: () =>
    set({
      phase: "idle",
      hasHydrated: true,
    }),

  reset: () => set({ phase: "initial", hasHydrated: false }),
}));
