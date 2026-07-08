import type { UserRole } from "@/types";
import { newId, nowIso } from "@/types";
import { seedCredentials } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { useUserStore } from "./useUserStore";
import { createPersistedStore } from "./persist";

type AuthResult = { success: true } | { success: false; error: string };

type AuthState = {
  currentUserId: string | null;
  credentials: Record<string, string>;
  login: (email: string, password: string) => AuthResult;
  register: (data: { name: string; email: string; password: string; role?: UserRole }) => AuthResult;
  logout: () => void;
  setPassword: (userId: string, password: string) => void;
  changePassword: (userId: string, currentPassword: string, nextPassword: string) => AuthResult;
};

export const useAuthStore = createPersistedStore<AuthState>("auth", (set, get) => ({
  currentUserId: null,
  credentials: { ...seedCredentials },

  login: (email, password) => {
    const normalized = email.trim().toLowerCase();
    const user = useUserStore
      .getState()
      .users.find((u) => u.email.toLowerCase() === normalized);

    if (!user) return { success: false, error: "No account found with that email." };
    if (!user.active) return { success: false, error: "This account is inactive. Contact your admin." };

    const stored = get().credentials[user.id];
    if (!stored || stored !== password) {
      return { success: false, error: "Incorrect password. Try again or register a new account." };
    }

    set({ currentUserId: user.id });
    logActivity({ who: user.name, what: "Signed in", kind: "info" });
    return { success: true };
  },

  register: ({ name, email, password, role = "Viewer" }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (trimmedName.length < 2) return { success: false, error: "Name must be at least 2 characters." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, error: "Enter a valid email address." };
    }
    if (password.length < 6) return { success: false, error: "Password must be at least 6 characters." };

    const existing = useUserStore.getState().users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) return { success: false, error: "An account with this email already exists. Sign in instead." };

    const user = useUserStore.getState().addUser({
      name: trimmedName,
      email: normalizedEmail,
      role,
      active: true,
      notifyEmail: true,
      notifyInApp: true,
      timezone: "Asia/Kolkata",
    });

    set((s) => ({
      currentUserId: user.id,
      credentials: { ...s.credentials, [user.id]: password },
    }));
    logActivity({ who: user.name, what: "Created account and signed in", kind: "success" });
    return { success: true };
  },

  logout: () => {
    const user = useUserStore.getState().users.find((u) => u.id === get().currentUserId);
    if (user) logActivity({ who: user.name, what: "Signed out", kind: "info" });
    set({ currentUserId: null });
  },

  setPassword: (userId, password) => {
    set((s) => ({ credentials: { ...s.credentials, [userId]: password } }));
  },

  changePassword: (userId, currentPassword, nextPassword) => {
    const stored = get().credentials[userId];
    if (!stored || stored !== currentPassword) {
      return { success: false, error: "Current password is incorrect." };
    }
    if (nextPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }
    if (nextPassword === currentPassword) {
      return { success: false, error: "New password must be different from the current one." };
    }
    set((s) => ({ credentials: { ...s.credentials, [userId]: nextPassword } }));
    const user = useUserStore.getState().users.find((u) => u.id === userId);
    logActivity({ who: user?.name ?? "You", what: "Changed account password", kind: "info" });
    return { success: true };
  },
}));

export function useCurrentUser() {
  const currentUserId = useAuthStore((s) => s.currentUserId);
  return useUserStore((s) => s.users.find((u) => u.id === currentUserId));
}
