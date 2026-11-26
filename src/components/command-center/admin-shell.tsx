import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeft,
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
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof adminSearch>> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("buildesk-admin-sidebar");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

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
    <div className="command-center flex min-h-screen bg-[#F4F7FC] text-[#0F172A] dark:bg-[#07111F] dark:text-slate-100">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col bg-[#0B1F3A] text-slate-100 transition-[width]",
          collapsed ? "w-[72px]" : "w-[250px]",
        )}
      >
        <div className="flex items-center gap-[13px] px-[13px] py-[21px]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
            B
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Buildesk</div>
              <div className="truncate text-[11px] text-slate-300">Command Center</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-[8px]">
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
                title={item.label}
                className={cn(
                  "flex items-center gap-[13px] rounded-lg px-[13px] py-[8px] text-[13px] text-slate-200 hover:bg-white/10",
                  active && "bg-blue-500 text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-[13px]">
          <div className={cn("flex items-center gap-[13px]", collapsed && "justify-center")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/30 text-xs font-semibold">
              {(user?.name ?? "A").slice(0, 1)}
            </div>
            {collapsed ? null : (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user?.name ?? "Admin"}</div>
                <div className="truncate text-[11px] text-slate-300">{user?.role ?? "Admin"}</div>
              </div>
            )}
          </div>
          {collapsed ? null : <div className="mt-[8px] text-[11px] text-slate-400">v1.0.0</div>}
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-[8px] flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            {collapsed ? null : "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0B1730]/90">
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem("buildesk-admin-sidebar", next ? "collapsed" : "open");
            }}
            className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
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
        <main className="min-w-0 flex-1 px-4 py-3">{children}</main>
      </div>
    </div>
  );
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
