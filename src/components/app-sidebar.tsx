import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Building2, Boxes, Route as RouteIcon, Package,
  Upload, FileText, Smartphone, Truck, HardHat, Plug, GraduationCap,
  LifeBuoy, RefreshCw, Users, BarChart3, Settings, Building, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-white">Buildesk</div>
          <div className="truncate text-[11px] text-sidebar-foreground/70">Onboarding & Post-Sales</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const showAdminDivider = item.to === "/master";
          return (
            <div key={item.to}>
              {showAdminDivider && (
                <div className="mx-3 mb-2 mt-4 border-t border-sidebar-border pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                  Administration
                </div>
              )}
              <Link
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                    style={{ width: 3 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10 truncate">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-[11px] text-sidebar-foreground/60">
        v1.0 · Buildesk Internal
      </div>
    </aside>
  );
}
