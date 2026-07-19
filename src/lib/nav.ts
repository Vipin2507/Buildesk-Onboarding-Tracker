import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Route as RouteIcon,
  Package,
  Upload,
  FileText,
  Smartphone,
  Truck,
  HardHat,
  Plug,
  GraduationCap,
  LifeBuoy,
  RefreshCw,
  Users,
  BarChart3,
  Settings,
  Database,
  CheckSquare,
  MapPin,
} from "lucide-react";
import type { RolePermissionKey } from "@/types";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Hide unless user is Admin or has this permission */
  permission?: RolePermissionKey;
  /** Administration block — Admin only */
  adminOnly?: boolean;
};

export const APP_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/onboarding", label: "Onboarding Tracker", icon: RouteIcon },
  { to: "/modules", label: "Modules & Add-ons", icon: Package },
  { to: "/data-migration", label: "Data Migration", icon: Upload },
  { to: "/documents", label: "Document Templates", icon: FileText },
  { to: "/customer-app", label: "Customer App", icon: Smartphone },
  { to: "/vendors", label: "Vendor Management", icon: Truck },
  { to: "/labor", label: "Labor Management", icon: HardHat },
  { to: "/integrations", label: "Integrations & Triggers", icon: Plug },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/support", label: "Support Desk", icon: LifeBuoy },
  { to: "/tasks", label: "Follow-up Tasks", icon: CheckSquare, permission: "manageTasks" },
  { to: "/client-visits", label: "Client Visits", icon: MapPin, permission: "manageClientVisits" },
  { to: "/renewals", label: "Renewals", icon: RefreshCw },
  { to: "/employees", label: "Employees", icon: Users, permission: "manageEmployees" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "viewReports" },
  { to: "/master", label: "Master Config", icon: Database, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function isNavActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

export function filterNavItems(
  items: NavItem[],
  ctx: { isAdmin: boolean; can: (key: RolePermissionKey) => boolean },
) {
  return items.filter((item) => {
    if (item.adminOnly && !ctx.isAdmin) return false;
    if (item.permission && !ctx.isAdmin && !ctx.can(item.permission)) return false;
    return true;
  });
}

