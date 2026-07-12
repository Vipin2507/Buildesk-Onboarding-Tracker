import type { User } from "@/types";
import { create } from "zustand";

/**
 * In-memory session mirror of the server cookie session.
 * Credentials live only on the server (SQLite + httpOnly cookie).
 */
type AuthState = {
  user: User | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
}));

export function useCurrentUser() {
  return useAuthStore((s) => s.user ?? undefined);
}
