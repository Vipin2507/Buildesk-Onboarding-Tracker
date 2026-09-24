import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Users, CalendarRange } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildCrmExecutiveAnalysis } from "@/lib/crm-executive-analysis";
import { cn } from "@/lib/utils";
import type { CrmAccount } from "@/types/crm-account";

const EASE = [0.22, 1, 0.36, 1] as const;

type TabId = "users" | "location" | "year";

export function CrmDashboardExecutiveAnalysis({ accounts }: { accounts: CrmAccount[] }) {
  const analysis = useMemo(() => buildCrmExecutiveAnalysis(accounts), [accounts]);
  const [tab, setTab] = useState<TabId>("users");

  const chartUsers = useMemo(
    () =>
      analysis.activeUsersByExecutive.slice(0, 12).map((r) => ({
        name: r.executive.length > 12 ? `${r.executive.slice(0, 11)}…` : r.executive,
        fullName: r.executive,
        users: r.activeUsers,
        accounts: r.accounts,
      })),
    [analysis.activeUsersByExecutive],
  );

  const chartLocations = useMemo(
    () =>
      analysis.usersByLocation.slice(0, 12).map((r) => ({
        name: r.location.length > 12 ? `${r.location.slice(0, 11)}…` : r.location,
        fullName: r.location,
        users: r.users,
        accounts: r.accounts,
      })),
    [analysis.usersByLocation],
  );

  const chartYears = useMemo(
    () =>
      [...analysis.clientsByYear]
        .filter((r) => r.year !== "Unknown")
        .slice(0, 10)
        .reverse()
        .map((r) => ({
          name: r.year,
          fullName: r.year,
          clients: r.clients,
        })),
    [analysis.clientsByYear],
  );

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Active users", icon: Users },
    { id: "location", label: "Location-wise", icon: MapPin },
    { id: "year", label: "Year-wise clients", icon: CalendarRange },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06, ease: EASE }}
      className="card-soft p-3"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">Executive analysis</h3>
          <p className="text-[10px] text-muted-foreground">
            Licensed seats &amp; accounts by sales executive · {analysis.totals.executives} executives ·{" "}
            {analysis.totals.activeUsers} active users · {analysis.totals.accounts} open accounts
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <div className="h-44">
          <ResponsiveContainer>
            {tab === "users" ? (
              <BarChart data={chartUsers.length ? chartUsers : [{ name: "—", users: 0 }]} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="var(--color-muted-foreground)" interval={0} angle={-25} textAnchor="end" height={44} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  formatter={(value: number, _n, item) => [
                    value,
                    (item?.payload as { fullName?: string })?.fullName ?? "Users",
                  ]}
                />
                <Bar dataKey="users" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : tab === "location" ? (
              <BarChart data={chartLocations.length ? chartLocations : [{ name: "—", users: 0 }]} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="var(--color-muted-foreground)" interval={0} angle={-25} textAnchor="end" height={44} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  formatter={(value: number, _n, item) => [
                    value,
                    (item?.payload as { fullName?: string })?.fullName ?? "Users",
                  ]}
                />
                <Bar dataKey="users" fill="var(--color-chart-2, #0d9488)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={chartYears.length ? chartYears : [{ name: "—", clients: 0 }]} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="clients" fill="var(--color-chart-3, #ca8a04)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="max-h-44 overflow-y-auto rounded-md border">
          {tab === "users" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Executive</th>
                  <th className="px-2 py-1.5 text-right font-medium">Active users</th>
                  <th className="px-2 py-1.5 text-right font-medium">Accounts</th>
                </tr>
              </thead>
              <tbody>
                {analysis.activeUsersByExecutive.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                      No active accounts
                    </td>
                  </tr>
                ) : (
                  analysis.activeUsersByExecutive.map((r) => (
                    <tr key={r.executive} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{r.executive}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.activeUsers}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {r.accounts}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "location" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Location</th>
                  <th className="px-2 py-1.5 text-right font-medium">Users</th>
                  <th className="px-2 py-1.5 font-medium">By executive</th>
                </tr>
              </thead>
              <tbody>
                {analysis.usersByLocation.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                      No location data
                    </td>
                  </tr>
                ) : (
                  analysis.usersByLocation.map((r) => (
                    <tr key={r.location} className="border-t align-top">
                      <td className="px-2 py-1.5 font-medium">{r.location}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.users}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.byExecutive
                          .slice(0, 4)
                          .map((e) => `${e.executive} (${e.users})`)
                          .join(" · ")}
                        {r.byExecutive.length > 4 ? "…" : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "year" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Year</th>
                  <th className="px-2 py-1.5 text-right font-medium">Clients</th>
                  <th className="px-2 py-1.5 font-medium">By executive</th>
                </tr>
              </thead>
              <tbody>
                {analysis.clientsByYear.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                      No client data
                    </td>
                  </tr>
                ) : (
                  analysis.clientsByYear.map((r) => (
                    <tr key={r.year} className="border-t align-top">
                      <td className="px-2 py-1.5 font-medium">{r.year}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.clients}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.byExecutive
                          .slice(0, 4)
                          .map((e) => `${e.executive} (${e.clients})`)
                          .join(" · ")}
                        {r.byExecutive.length > 4 ? "…" : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
