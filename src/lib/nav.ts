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
  MessageSquareText,
  RefreshCw,
  Users,
  BarChart3,
  Settings,
  Database,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Calendar,
  MapPin,
  Zap,
  MessagesSquare,
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
  /** Optional group label when listed under Settings */
  settingsGroup?: string;
};

/** Primary ERP sidebar — keep lean. */
export const APP_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/support", label: "Support Desk", icon: LifeBuoy },
  { to: "/tickets", label: "Ticket Tracking", icon: MessageSquareText },
  { to: "/live-chat", label: "Live Chat", icon: MessagesSquare, permission: "manageTickets" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, permission: "manageTasks" },
  { to: "/dpr", label: "My DPR", icon: ClipboardCheck, permission: "manageDpr", exact: true },
  { to: "/meetings", label: "Meetings", icon: Calendar, permission: "manageErpMeetings" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "viewReports" },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Secondary ERP destinations — linked from Settings, not the main sidebar. */
export const APP_SETTINGS_NAV: NavItem[] = [
  {
    to: "/onboarding",
    label: "Onboarding Tracker",
    icon: RouteIcon,
    settingsGroup: "Operations",
  },
  {
    to: "/modules",
    label: "Modules & Add-ons",
    icon: Package,
    settingsGroup: "Operations",
  },
  {
    to: "/data-migration",
    label: "Data Migration",
    icon: Upload,
    settingsGroup: "Operations",
  },
  {
    to: "/documents",
    label: "Document Templates",
    icon: FileText,
    settingsGroup: "Operations",
  },
  {
    to: "/customer-app",
    label: "Customer App",
    icon: Smartphone,
    settingsGroup: "Operations",
  },
  {
    to: "/vendors",
    label: "Vendor Management",
    icon: Truck,
    settingsGroup: "Operations",
  },
  {
    to: "/labor",
    label: "Labor Management",
    icon: HardHat,
    settingsGroup: "Operations",
  },
  {
    to: "/integrations",
    label: "Integrations & Triggers",
    icon: Plug,
    settingsGroup: "Operations",
  },
  {
    to: "/training",
    label: "Training",
    icon: GraduationCap,
    settingsGroup: "Operations",
  },
  {
    to: "/dpr/tracker",
    label: "DPR Tracker",
    icon: ClipboardList,
    permission: "viewDprTracker",
    settingsGroup: "Operations",
  },
  {
    to: "/client-visits",
    label: "Client Visits",
    icon: MapPin,
    permission: "manageClientVisits",
    settingsGroup: "Operations",
  },
  {
    to: "/renewals",
    label: "Renewals",
    icon: RefreshCw,
    settingsGroup: "Operations",
  },
  {
    to: "/employees",
    label: "Employees",
    icon: Users,
    permission: "manageEmployees",
    settingsGroup: "Operations",
  },
  {
    to: "/master",
    label: "Master Config",
    icon: Database,
    adminOnly: true,
    settingsGroup: "Administration",
  },
  {
    to: "/automation",
    label: "Automation",
    icon: Zap,
    adminOnly: true,
    settingsGroup: "Administration",
  },
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
