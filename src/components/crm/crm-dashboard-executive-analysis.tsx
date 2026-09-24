import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, Headphones, MapPin, UserRound } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildCrmExecutiveAnalysis,
  EXECUTIVE_ROLE_LABEL,
  type ExecutiveAccountRow,
  type ExecutiveRole,
} from "@/lib/crm-executive-analysis";
import { cn } from "@/lib/utils";
import type { CrmAccount } from "@/types/crm-account";

const EASE = [0.22, 1, 0.36, 1] as const;

type TabId = "sales" | "support1" | "support2" | "location" | "year";

function toChart(rows: { name: string; accounts: number }[]) {
  return rows.slice(0, 12).map((r) => ({
    name: r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name,
    fullName: r.name,
    accounts: r.accounts,
  }));
}

const ROLE_OPTIONS: ExecutiveRole[] = ["sales", "support1", "support2"];

export function CrmDashboardExecutiveAnalysis({ accounts }: { accounts: CrmAccount[] }) {
  const [tab, setTab] = useState<TabId>("sales");
  const [locationRole, setLocationRole] = useState<ExecutiveRole>("sales");
  const [yearRole, setYearRole] = useState<ExecutiveRole>("sales");

  const analysis = useMemo(
    () => buildCrmExecutiveAnalysis(accounts, { locationRole, yearRole }),
    [accounts, locationRole, yearRole],
  );

  const managerRows: ExecutiveAccountRow[] =
    tab === "sales"
      ? analysis.bySalesManager
      : tab === "support1"
        ? analysis.bySupport1
        : tab === "support2"
          ? analysis.bySupport2
          : [];

  const chartData = useMemo(() => {
    if (tab === "location") {
      return toChart(analysis.byLocation.map((r) => ({ name: r.key, accounts: r.accounts })));
    }
    if (tab === "year") {
      return toChart(
        [...analysis.byYear]
          .filter((r) => r.key !== "Unknown")
          .slice()
          .reverse()
          .map((r) => ({ name: r.key, accounts: r.accounts })),
      );
    }
    return toChart(managerRows);
  }, [tab, analysis.byLocation, analysis.byYear, managerRows]);

  const tabs: { id: TabId; label: string; icon: typeof UserRound }[] = [
    { id: "sales", label: "Sales manager", icon: UserRound },
    { id: "support1", label: "Support 1", icon: Headphones },
    { id: "support2", label: "Support 2", icon: Headphones },
    { id: "location", label: "Location", icon: MapPin },
    { id: "year", label: "Year", icon: CalendarRange },
  ];

  const tableTitle =
    tab === "sales"
      ? "Sales manager"
      : tab === "support1"
        ? "Support 1"
        : tab === "support2"
          ? "Support 2"
          : tab === "location"
            ? "Location"
            : "Year";

  const subRole = tab === "location" ? locationRole : yearRole;
  const setSubRole = tab === "location" ? setLocationRole : setYearRole;
  const breakdownLabel = `By ${EXECUTIVE_ROLE_LABEL[subRole].toLowerCase()}`;

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
            Active accounts by manager, location, and year · {analysis.totals.activeAccounts}{" "}
            active accounts
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

      {tab === "location" || tab === "year" ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Break down by</span>
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSubRole(role)}
              className={cn(
                "inline-flex h-6 items-center rounded-md px-2 text-[10px] font-medium",
                subRole === role
                  ? "bg-foreground text-background"
                  : "border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {EXECUTIVE_ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2.5 lg:grid-cols-2">
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart
              data={chartData.length ? chartData : [{ name: "—", accounts: 0 }]}
              margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
            >
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 8 }}
                stroke="var(--color-muted-foreground)"
                interval={0}
                angle={tab === "year" ? 0 : -25}
                textAnchor={tab === "year" ? "middle" : "end"}
                height={tab === "year" ? 28 : 44}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                formatter={(value: number, _n, item) => [
                  value,
                  (item?.payload as { fullName?: string })?.fullName ?? "Active accounts",
                ]}
              />
              <Bar dataKey="accounts" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="max-h-44 overflow-y-auto rounded-md border">
          {tab === "location" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Location</th>
                  <th className="px-2 py-1.5 text-right font-medium">Active accounts</th>
                  <th className="px-2 py-1.5 font-medium">{breakdownLabel}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.byLocation.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                      No active accounts
                    </td>
                  </tr>
                ) : (
                  analysis.byLocation.map((r) => (
                    <tr key={r.key} className="border-t align-top">
                      <td className="px-2 py-1.5 font-medium">{r.key}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.accounts}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.byRole
                          .slice(0, 4)
                          .map((m) => `${m.name} (${m.accounts})`)
                          .join(" · ")}
                        {r.byRole.length > 4 ? "…" : ""}
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
                  <th className="px-2 py-1.5 text-right font-medium">Active accounts</th>
                  <th className="px-2 py-1.5 font-medium">{breakdownLabel}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.byYear.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                      No active accounts
                    </td>
                  </tr>
                ) : (
                  analysis.byYear.map((r) => (
                    <tr key={r.key} className="border-t align-top">
                      <td className="px-2 py-1.5 font-medium">{r.key}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.accounts}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.byRole
                          .slice(0, 4)
                          .map((m) => `${m.name} (${m.accounts})`)
                          .join(" · ")}
                        {r.byRole.length > 4 ? "…" : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "sales" || tab === "support1" || tab === "support2" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">{tableTitle}</th>
                  <th className="px-2 py-1.5 text-right font-medium">Active accounts</th>
                </tr>
              </thead>
              <tbody>
                {managerRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-2 py-4 text-center text-muted-foreground">
                      No active accounts
                    </td>
                  </tr>
                ) : (
                  managerRows.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{r.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.accounts}</td>
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
