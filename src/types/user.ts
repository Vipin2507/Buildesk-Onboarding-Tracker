import type { Timestamps } from "./common";

export type UserRole = string;

/** Built-in role keys shipped with the platform */
export type SystemUserRole = "Admin" | "Manager" | "Viewer";

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
