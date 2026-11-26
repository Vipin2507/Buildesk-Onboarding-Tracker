import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
  Briefcase,
  Building2,
  CalendarClock,
  FileBarChart,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  AdminFilterProvider,
  useAdminFilters,
  type AppFilter,
  type RangeId,
} from "@/components/command-center/filters";
import { useTheme } from "@/components/theme-provider";
import { authLogout } from "@/lib/api";
import { adminSearch } from "@/server/api/command-center";
import { useAuthStore } from "@/stores";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "buildesk-admin-sidebar";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/employees", label: "Employee Intelligence", icon: Users },
  { to: "/admin/activity", label: "Live Activity", icon: Radio },
  { to: "/admin/attendance", label: "Attendance & Sessions", icon: CalendarClock },
  { to: "/admin/work", label: "Work & Productivity", icon: ClipboardList },
  { to: "/admin/erp", label: "ERP Monitoring", icon: Building2 },
  { to: "/admin/crm", label: "CRM Monitoring", icon: Briefcase },
  { to: "/admin/security", label: "Security Center", icon: Shield },
  { to: "/admin/reports", label: "Reports & Analytics", icon: FileBarChart },
  { to: "/admin/health", label: "System Health", icon: HeartPulse },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/settings", label: "Admin Settings", icon: Settings },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminFilterProvider>
      <Shell>{children}</Shell>
    </AdminFilterProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { resolved, toggleLightDark } = useTheme();
  const { rangeId, setRangeId, app, setApp } = useAdminFilters();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof adminSearch>> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void adminSearch({ data: { q } }).then((result) => setHits(result));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function logout() {
    await authLogout();
    void navigate({ to: "/login", search: { mode: "login" } });
  }

  return (
    <div className="command-center flex h-dvh overflow-hidden bg-[#F4F7FC] text-[#0F172A] dark:bg-[#07111F] dark:text-slate-100">
      <AdminSidebar pathname={pathname} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-14 shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0B1730]/90">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employees, companies, projects, tasks"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            {hits?.success && query.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <SearchGroup title="Employees" empty="No employees">
                  {hits.data.people.map((person) => (
                    <Link
                      key={person.id}
                      to="/admin/employees/$userId"
                      params={{ userId: person.id }}
                      className="block rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => setQuery("")}
                    >
                      {person.name} <span className="text-slate-500">{person.email}</span>
                    </Link>
                  ))}
                </SearchGroup>
                <SearchGroup title="Companies" empty="No companies">
                  {hits.data.companies.map((company) => (
                    <div key={company.id} className="px-2 py-1">
                      {company.name}
                    </div>
                  ))}
                </SearchGroup>
                <SearchGroup title="Projects" empty="No projects">
                  {hits.data.projects.map((project) => (
                    <div key={project.id} className="px-2 py-1">
                      {project.name}
                    </div>
                  ))}
                </SearchGroup>
                <SearchGroup title="Tasks" empty="No tasks">
                  {hits.data.tasks.map((task) => (
                    <div key={task.id} className="px-2 py-1">
                      {task.title} <span className="text-slate-500">{task.productScope}</span>
                    </div>
                  ))}
                </SearchGroup>
              </div>
            ) : null}
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
            {(["all", "erp", "crm"] as AppFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setApp(item)}
                className={cn(
                  "rounded-md px-2 py-1 uppercase",
                  app === item && "bg-blue-600 text-white",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <select
            value={rangeId}
            onChange={(event) => setRangeId(event.target.value as RangeId)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Activity className="h-3.5 w-3.5" /> Live
          </span>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => toggleLightDark()}
            className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 pr-2 outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#009bff] text-xs font-semibold text-white">
                  {initials(user?.name ?? "A")}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-xs font-semibold">{user?.name ?? "Admin"}</span>
                  <span className="block text-[10px] text-slate-500">{user?.role ?? "Admin"}</span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{user?.name ?? "Admin"}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void navigate({ to: "/admin/settings" })}>
                <Settings className="mr-2 h-4 w-4" />
                Admin settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => {
              toast.message("Open Security Center for unresolved alerts.");
              void navigate({ to: "/admin/security" });
            }}
            className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
            aria-label="Security alerts"
          >
            <Shield className="h-4 w-4" />
          </button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-3">{children}</main>
      </div>
    </div>
  );
}

function AdminSidebar({ pathname }: { pathname: string }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "0" || stored === "open") setCollapsed(false);
      if (stored === "1" || stored === "collapsed") setCollapsed(true);
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
    <div className="relative shrink-0">
      <aside
        className={cn(
          "sticky top-0 flex h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-[52px]" : "w-52",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center overflow-hidden",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          )}
        >
          <button
            type="button"
            onClick={collapsed ? toggle : undefined}
            title={collapsed ? "Expand sidebar" : undefined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground",
              collapsed && "cursor-pointer ring-2 ring-sidebar-primary/40 ring-offset-2 ring-offset-sidebar",
            )}
          >
            B
          </button>
          {!collapsed ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-semibold tracking-tight text-white">Buildesk</div>
              <div className="truncate text-[10px] text-sidebar-foreground/70">Command Center</div>
            </div>
          ) : null}
        </div>

        <nav
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-3",
            "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.28)_transparent]",
            collapsed ? "items-center px-1" : "px-1.5",
          )}
        >
          {NAV.map((item) => {
            const active =
              item.to === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium",
                  "transition-[color,padding,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  collapsed ? "h-9 w-9 justify-center p-0" : "px-2.5 py-1.5",
                  active
                    ? "text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 rounded-md bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                ) : null}
                {active && !collapsed ? (
                  <motion.span
                    layoutId="admin-sidebar-indicator"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                ) : null}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                {!collapsed ? <span className="relative z-10 truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "overflow-hidden border-t border-sidebar-border transition-[opacity,max-height,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed ? "max-h-0 opacity-0" : "max-h-16 px-3 py-3 opacity-100",
          )}
        >
          <div className="whitespace-nowrap text-[10px] text-sidebar-foreground/60">
            v1.0 · Buildesk Internal
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute top-[3.25rem] z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center",
          "rounded-full border border-border bg-card text-foreground shadow-md",
          "transition-[right,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "-right-4",
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "A";
}

function SearchGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const list = Array.isArray(children) ? children : [children];
  const present = list.some(Boolean);
  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {present ? children : <div className="px-2 py-1 text-slate-400">{empty}</div>}
    </div>
  );
}
