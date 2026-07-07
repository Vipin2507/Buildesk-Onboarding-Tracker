import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { StateCreator } from "zustand";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getStorage(): StateStorage {
  if (typeof window === "undefined") return noopStorage;
  return localStorage;
}

export function createPersistedStore<T extends object>(
  name: string,
  initializer: StateCreator<T, [], [["zustand/persist", T]]>,
) {
  return create<T>()(
    persist(initializer, {
      name: `buildesk-${name}`,
      storage: createJSONStorage(getStorage),
      version: 1,
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error && typeof window !== "undefined") {
          console.warn(`[buildesk] Clearing corrupt store "${name}"`, error);
          localStorage.removeItem(`buildesk-${name}`);
        }
      },
    }),
  );
}

export function touch<T extends { updatedAt: string }>(entity: T): T {
  return { ...entity, updatedAt: new Date().toISOString() };
}
