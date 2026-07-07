import type { User } from "@/types";
import { newId, nowIso } from "@/types";
import { seedUsers } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type UserState = {
  users: User[];
  currentUserId: string;
  addUser: (data: Omit<User, "id" | "createdAt" | "updatedAt">) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => User | undefined;
  getCurrentUser: () => User | undefined;
};

export const useUserStore = createPersistedStore<UserState>("users", (set, get) => ({
  users: seedUsers,
  currentUserId: "user-1",

  addUser: (data) => {
    const now = nowIso();
    const user: User = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ users: [...s.users, user] }));
    logActivity({ who: "You", what: `Invited user ${user.name}`, kind: "success" });
    return user;
  },

  updateUser: (id, data) => {
    set((s) => ({ users: s.users.map((u) => (u.id === id ? touch({ ...u, ...data }) : u)) }));
    logActivity({ who: "You", what: "Updated user", kind: "info" });
  },

  deleteUser: (id) => {
    const user = get().users.find((u) => u.id === id);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
    if (user) logActivity({ who: "You", what: `Deactivated user ${user.name}`, kind: "warning" });
    return user;
  },

  getCurrentUser: () => get().users.find((u) => u.id === get().currentUserId),
}));
