import type { Timestamps } from "./common";

export type UserRole = string;

/** Built-in role keys shipped with the platform */
export type SystemUserRole = "Admin" | "Manager" | "Viewer";

/** Which product shell the user lands in after login */
export type ProductScope = "erp" | "crm";

export type User = Timestamps & {
  id: string;
  name: string;
  /** Sign-in / login email */
  email: string;
  /** Work inbox for CRM automation & executive notifications */
  workEmail?: string;
  role: UserRole;
  active: boolean;
  /** erp = Buildesk tracker; crm = separate CRM product */
  productScope?: ProductScope;
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
