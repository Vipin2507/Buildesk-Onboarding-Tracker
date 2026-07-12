import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Boxes,
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
  Building,
  Database,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "buildesk-sidebar-collapsed";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/projects", label: "Projects", icon: Boxes },
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
  { to: "/renewals", label: "Renewals", icon: RefreshCw },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/master", label: "Master Config", icon: Database },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[52px]" : "w-52",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 py-4",
          collapsed ? "flex-col px-1.5" : "px-3",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Building className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight text-white">Buildesk</div>
            <div className="truncate text-[10px] text-sidebar-foreground/70">Onboarding & Post-Sales</div>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-3", collapsed ? "px-1" : "px-1.5")}>
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const showAdminDivider = item.to === "/master";
          return (
            <div key={item.to}>
              {showAdminDivider && (
                <div
                  className={cn(
                    "mb-1.5 mt-3 border-t border-sidebar-border pt-2.5",
                    collapsed
                      ? "mx-1"
                      : "mx-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45",
                  )}
                >
                  {!collapsed && "Administration"}
                </div>
              )}
              <Link
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-md text-[13px] font-medium transition-colors",
                  collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
                  active
                    ? "text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                )}
                {active && !collapsed && (
                  <motion.span
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                    style={{ width: 3 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border px-3 py-3 text-[10px] text-sidebar-foreground/60">
          v1.0 · Buildesk Internal
        </div>
      )}
    </aside>
  );
}
