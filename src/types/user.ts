import type { Timestamps } from "./common";

export type UserRole = "Admin" | "Manager" | "Viewer";

export type User = Timestamps & {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};
