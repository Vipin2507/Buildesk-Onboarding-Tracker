import {
  LayoutDashboard,
  Building2,
  Database,
  Settings,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** CRM product navigation — separate from ERP APP_NAV. */
export const CRM_NAV: NavItem[] = [
  { to: "/crm", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/crm/accounts", label: "Accounts", icon: Building2 },
  { to: "/crm/master", label: "Master", icon: Database, adminOnly: true },
  { to: "/crm/settings", label: "Settings", icon: Settings },
];
