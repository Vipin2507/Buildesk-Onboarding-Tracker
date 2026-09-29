import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ChevronDown, Headphones, MapPin, UserRound } from "lucide-react";

import {
  buildCrmExecutiveAnalysis,
  EXECUTIVE_ROLE_LABEL,
  type ExecutiveAccountRow,
  type ExecutiveDetailRow,
  type ExecutiveRole,
  type ExecutiveYearMonthRow,
} from "@/lib/crm-executive-analysis";
import { isAdminRoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores";
import type { CrmDashboardDrillDownFilter } from "@/stores/crm-dashboard-selectors";
import type { CrmAccount } from "@/types/crm-account";

const EASE = [0.22, 1, 0.36, 1] as const;

type TabId = "sales" | "support1" | "support2" | "location" | "year";

const ROLE_OPTIONS: ExecutiveRole[] = ["sales", "support1", "support2"];

type OpenDrillDown = (filter: CrmDashboardDrillDownFilter) => void;

function ExpandableExecutiveTable({
  rows,
  personLabel,
  breakdownLabel,
  role,
  onOpenDrillDown,
}: {
  rows: ExecutiveDetailRow[];
  personLabel: string;
  breakdownLabel: string;
  role: ExecutiveRole;
  onOpenDrillDown: OpenDrillDown;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-white px-4 py-10 text-center text-xs text-muted-foreground">
        No active accounts
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="sticky top-0 z-[1] grid grid-cols-[2.5rem_1fr_auto] gap-3 border-b border-border bg-white px-4 py-3 text-xs font-medium text-muted-foreground">
        <span className="tabular-nums">S.No.</span>
        <span className="pl-7">{personLabel}</span>
        <span className="text-right">Active accounts</span>
      </div>

      <ul>
        {rows.map((r, index) => {
          const expanded = open === r.name;
          return (
            <li key={r.name} className="border-b border-border bg-white last:border-b-0">
              <div className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <span className="tabular-nums text-xs text-muted-foreground">{index + 1}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : r.name)}
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse regions" : "Expand regions"}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDrillDown({ type: "executive", role, name: r.name })
                    }
                    className="min-w-0 truncate text-left text-sm font-medium text-foreground hover:underline"
                  >
                    {r.name}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDrillDown({ type: "executive", role, name: r.name })
                  }
                  className="text-right text-base font-semibold tabular-nums text-foreground hover:underline"
                >
                  {r.accounts}
                </button>
              </div>

              <motion.div
                initial={false}
                animate={{
                  height: expanded ? "auto" : 0,
                  opacity: expanded ? 1 : 0,
                }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="border-t border-border bg-white px-4 pb-1 pt-1">
                  <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="normal-case tracking-normal">S.No.</span>
                    <span>{breakdownLabel}</span>
                    <span className="text-right normal-case tracking-normal">Accounts</span>
                  </div>
                  <ul className="max-h-56 overflow-y-auto">
                    {r.breakdown.map((b, locIndex) => (
                      <li key={b.label}>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDrillDown({
                              type: "executive",
                              role,
                              name: r.name,
                              region: b.label,
                            })
                          }
                          className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t border-border/80 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
                        >
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {locIndex + 1}
                          </span>
                          <span className="min-w-0 truncate text-muted-foreground">
                            {b.label === "—" ? "Unspecified" : b.label}
                          </span>
                          <span className="shrink-0 text-right tabular-nums font-medium text-foreground">
                            {b.accounts}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Year → month → executive expandable table. */
function ExpandableYearMonthTable({
  rows,
  executiveLabel,
  role,
  onOpenDrillDown,
}: {
  rows: ExecutiveYearMonthRow[];
  executiveLabel: string;
  role: ExecutiveRole;
  onOpenDrillDown: OpenDrillDown;
}) {
  const [openYear, setOpenYear] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-white px-4 py-10 text-center text-xs text-muted-foreground">
        No active accounts
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="sticky top-0 z-[1] grid grid-cols-[2.5rem_1fr_auto] gap-3 border-b border-border bg-white px-4 py-3 text-xs font-medium text-muted-foreground">
        <span className="tabular-nums">S.No.</span>
        <span className="pl-7">Year</span>
        <span className="text-right">Active accounts</span>
      </div>

      <ul>
        {rows.map((yearRow, yearIndex) => {
          const yearExpanded = openYear === yearRow.name;
          return (
            <li key={yearRow.name} className="border-b border-border bg-white last:border-b-0">
              <div className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <span className="tabular-nums text-xs text-muted-foreground">{yearIndex + 1}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenYear(yearExpanded ? null : yearRow.name);
                      if (yearExpanded) setOpenMonth(null);
                    }}
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-expanded={yearExpanded}
                    aria-label={yearExpanded ? "Collapse months" : "Expand months"}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        yearExpanded && "rotate-180",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDrillDown({
                        type: "executive",
                        role,
                        year: yearRow.name,
                      })
                    }
                    className="min-w-0 truncate text-left text-sm font-medium text-foreground hover:underline"
                  >
                    {yearRow.name}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDrillDown({
                      type: "executive",
                      role,
                      year: yearRow.name,
                    })
                  }
                  className="text-right text-base font-semibold tabular-nums text-foreground hover:underline"
                >
                  {yearRow.accounts}
                </button>
              </div>

              <motion.div
                initial={false}
                animate={{
                  height: yearExpanded ? "auto" : 0,
                  opacity: yearExpanded ? 1 : 0,
                }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="border-t border-border bg-muted/20 px-2 pb-1 pt-1 sm:px-4">
                  <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="normal-case tracking-normal">S.No.</span>
                    <span className="pl-7">Month</span>
                    <span className="text-right normal-case tracking-normal">Accounts</span>
                  </div>
                  <ul>
                    {yearRow.months.map((monthRow, monthIndex) => {
                      const monthKey = `${yearRow.name}:${monthRow.monthKey}`;
                      const monthExpanded = openMonth === monthKey;
                      return (
                        <li
                          key={monthKey}
                          className="border-t border-border/80 bg-white first:border-t-0"
                        >
                          <div className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-2 py-2.5 hover:bg-muted/30">
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {monthIndex + 1}
                            </span>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMonth(monthExpanded ? null : monthKey)
                                }
                                className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-expanded={monthExpanded}
                                aria-label={
                                  monthExpanded ? "Collapse executives" : "Expand executives"
                                }
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                    monthExpanded && "rotate-180",
                                  )}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenDrillDown({
                                    type: "executive",
                                    role,
                                    year: yearRow.name,
                                    monthKey: monthRow.monthKey,
                                  })
                                }
                                className="min-w-0 truncate text-left text-sm font-medium text-foreground hover:underline"
                              >
                                {monthRow.name}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDrillDown({
                                  type: "executive",
                                  role,
                                  year: yearRow.name,
                                  monthKey: monthRow.monthKey,
                                })
                              }
                              className="text-right text-sm font-semibold tabular-nums text-foreground hover:underline"
                            >
                              {monthRow.accounts}
                            </button>
                          </div>

                          <motion.div
                            initial={false}
                            animate={{
                              height: monthExpanded ? "auto" : 0,
                              opacity: monthExpanded ? 1 : 0,
                            }}
                            transition={{ duration: 0.24, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/60 bg-muted/10 px-2 pb-1 pt-1 sm:pl-6">
                              <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <span className="normal-case tracking-normal">S.No.</span>
                                <span>{executiveLabel}</span>
                                <span className="text-right normal-case tracking-normal">
                                  Accounts
                                </span>
                              </div>
                              <ul className="max-h-48 overflow-y-auto">
                                {monthRow.executives.map((exec, execIndex) => (
                                  <li key={exec.name}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenDrillDown({
                                          type: "executive",
                                          role,
                                          name: exec.name,
                                          year: yearRow.name,
                                          monthKey: monthRow.monthKey,
                                        })
                                      }
                                      className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t border-border/70 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                                    >
                                      <span className="tabular-nums text-xs text-muted-foreground">
                                        {execIndex + 1}
                                      </span>
                                      <span className="min-w-0 truncate text-muted-foreground">
                                        {exec.name}
                                      </span>
                                      <span className="shrink-0 text-right tabular-nums font-medium text-foreground">
                                        {exec.accounts}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CrmDashboardExecutiveAnalysis({
  accounts,
  onOpenDrillDown,
}: {
  accounts: CrmAccount[];
  onOpenDrillDown: OpenDrillDown;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = isAdminRoleKey(currentUser?.role);
  const [tab, setTab] = useState<TabId>("sales");
  const [locationRole, setLocationRole] = useState<ExecutiveRole>("sales");
  const [yearRole, setYearRole] = useState<ExecutiveRole>("sales");

  const analysis = useMemo(
    () =>
      buildCrmExecutiveAnalysis(accounts, {
        locationRole,
        yearRole,
        viewerName: currentUser?.name,
        isAdmin,
      }),
    [accounts, locationRole, yearRole, currentUser?.name, isAdmin],
  );

  const managerRole: ExecutiveRole =
    tab === "support1" ? "support1" : tab === "support2" ? "support2" : "sales";

  const managerRows: ExecutiveAccountRow[] =
    tab === "sales"
      ? analysis.bySalesManager
      : tab === "support1"
        ? analysis.bySupport1
        : tab === "support2"
          ? analysis.bySupport2
          : [];

  const tabs: { id: TabId; label: string; icon: typeof UserRound }[] = [
    { id: "sales", label: "Sales manager", icon: UserRound },
    { id: "support1", label: "Support 1", icon: Headphones },
    { id: "support2", label: "Support 2", icon: Headphones },
    { id: "location", label: "Region", icon: MapPin },
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
            ? EXECUTIVE_ROLE_LABEL[locationRole]
            : EXECUTIVE_ROLE_LABEL[yearRole];

  const subRole = tab === "location" ? locationRole : yearRole;
  const setSubRole = tab === "location" ? setLocationRole : setYearRole;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06, ease: EASE }}
      className="card-soft p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">Executive analysis</h3>
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? `Active accounts by manager, region, and year · ${analysis.totals.activeAccounts} active accounts`
              : `Your active accounts only · ${analysis.totals.activeAccounts} assigned active accounts`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "location" || tab === "year" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isAdmin ? "Show executives as" : "View your role as"}
          </span>
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSubRole(role)}
              className={cn(
                "inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium",
                subRole === role
                  ? "bg-foreground text-background"
                  : "border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {EXECUTIVE_ROLE_LABEL[role]}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">
            · click a count to open accounts · chevron to expand{" "}
            {tab === "location" ? "regions" : "months / executives"}
          </span>
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Click a row to open matching accounts
        </p>
      )}

      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-white">
        {tab === "location" ? (
          <ExpandableExecutiveTable
            rows={analysis.byLocation}
            personLabel={tableTitle}
            breakdownLabel="Region"
            role={locationRole}
            onOpenDrillDown={onOpenDrillDown}
          />
        ) : null}

        {tab === "year" ? (
          <ExpandableYearMonthTable
            rows={analysis.byYear}
            executiveLabel={EXECUTIVE_ROLE_LABEL[yearRole]}
            role={yearRole}
            onOpenDrillDown={onOpenDrillDown}
          />
        ) : null}

        {tab === "sales" || tab === "support1" || tab === "support2" ? (
          <table className="w-full bg-white text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-14 px-4 py-3 font-medium">S.No.</th>
                <th className="px-4 py-3 font-medium">{tableTitle}</th>
                <th className="px-4 py-3 text-right font-medium">Active accounts</th>
              </tr>
            </thead>
            <tbody>
              {managerRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No active accounts
                  </td>
                </tr>
              ) : (
                managerRows.map((r, index) => (
                  <tr
                    key={r.name}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onOpenDrillDown({
                        type: "executive",
                        role: managerRole,
                        name: r.name,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenDrillDown({
                          type: "executive",
                          role: managerRole,
                          name: r.name,
                        });
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                      {r.accounts}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>
    </motion.div>
  );
}
