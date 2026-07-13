import type { User } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";
import {
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";

type UserState = {
  users: User[];
  addUser: (data: Omit<User, "id" | "createdAt" | "updatedAt">) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => User | undefined;
};

/** Server SQLite is authoritative — never re-seed from code after deletes. */
export const useUserStore = createPersistedStore<UserState>("users-v2", (set, get) => ({
  users: [],

  addUser: (data) => {
    const now = nowIso();
    const user: User = { ...data, id: newId(), createdAt: now, updatedAt: now };
    set((s) => ({ users: [...s.users, user] }));
    logActivity({ who: "You", what: `Invited user ${user.name}`, kind: "success" });
    serverSync("createUser", () =>
      apiCreateUser({
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          phone: user.phone,
          jobTitle: user.jobTitle,
          department: user.department,
        },
      }).then((created) => {
        useUserStore.setState((s) => ({
          users: s.users.map((u) => (u.id === user.id ? created : u)),
        }));
      }),
    );
    return user;
  },

  updateUser: (id, data) => {
    set((s) => ({ users: s.users.map((u) => (u.id === id ? touch({ ...u, ...data }) : u)) }));
    logActivity({ who: "You", what: "Updated user", kind: "info" });
    serverSync("updateUser", () => apiUpdateUser({ data: { id, patch: data } }));
  },

  deleteUser: (id) => {
    const user = get().users.find((u) => u.id === id);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
    if (user) {
      logActivity({ who: "You", what: `Deactivated user ${user.name}`, kind: "warning" });
      serverSync("deleteUser", () => apiDeleteUser({ data: { id } }));
    }
    return user;
  },
}));
