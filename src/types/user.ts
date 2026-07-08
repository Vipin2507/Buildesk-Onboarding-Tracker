import type { Timestamps } from "./common";

export type UserRole = "Admin" | "Manager" | "Viewer";

export type User = Timestamps & {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  /** Data URL or remote URL for avatar. */
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  timezone?: string;
  bio?: string;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
};
