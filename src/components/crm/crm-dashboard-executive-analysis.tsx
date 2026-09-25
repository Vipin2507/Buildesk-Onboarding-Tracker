import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ChevronDown, Headphones, MapPin, UserRound } from "lucide-react";

import {
  buildCrmExecutiveAnalysis,
  EXECUTIVE_ROLE_LABEL,
  type ExecutiveAccountRow,
  type ExecutiveDetailRow,
  type ExecutiveRole,
} from "@/lib/crm-executive-analysis";
import { isAdminRoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";

const EASE = [0.22, 1, 0.36, 1] as const;

type TabId = "sales" | "support1" | "support2" | "location" | "year";

const ROLE_OPTIONS: ExecutiveRole[] = ["sales", "support1", "support2"];

function ExpandableExecutiveTable({
  rows,
  personLabel,
  breakdownLabel,
}: {
  rows: ExecutiveDetailRow[];
  personLabel: string;
  breakdownLabel: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-xs text-muted-foreground">No active accounts</div>
    );
  }

  return (
    <div className="w-full">
      <div className="sticky top-0 z-[1] grid grid-cols-[1fr_auto] gap-4 border-b border-border/70 bg-muted/95 px-4 py-3 text-xs font-medium text-muted-foreground">
        <span className="pl-7">{personLabel}</span>
        <span className="text-right">Active accounts</span>
      </div>

      <ul className="divide-y divide-border/70">
        {rows.map((r) => {
          const expanded = open === r.name;
          return (
            <li key={r.name} className={cn(expanded && "bg-muted/20")}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.name)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                aria-expanded={expanded}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      expanded && "rotate-180",
                    )}
                  />
                  <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                </span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {r.accounts}
                </span>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: expanded ? "auto" : 0,
                  opacity: expanded ? 1 : 0,
                }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 px-4 pb-3 pl-11">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {breakdownLabel}
                  </p>
                  <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {r.breakdown.map((b) => (
                      <li
                        key={b.label}
                        className="flex items-baseline justify-between gap-4 py-1 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {b.label === "—" ? "Unspecified" : b.label}
                        </span>
                        <span className="shrink-0 tabular-nums font-medium text-foreground">
                          {b.accounts}
                        </span>
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

export function CrmDashboardExecutiveAnalysis({ accounts }: { accounts: CrmAccount[] }) {
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
              ? `Active accounts by manager, location, and year · ${analysis.totals.activeAccounts} active accounts`
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
            · click a row to expand {tab === "location" ? "locations" : "years"}
          </span>
        </div>
      ) : null}

      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border/80">
        {tab === "location" ? (
          <ExpandableExecutiveTable
            rows={analysis.byLocation}
            personLabel={tableTitle}
            breakdownLabel="Location"
          />
        ) : null}

        {tab === "year" ? (
          <ExpandableExecutiveTable
            rows={analysis.byYear}
            personLabel={tableTitle}
            breakdownLabel="Year"
          />
        ) : null}

        {tab === "sales" || tab === "support1" || tab === "support2" ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-muted/95 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{tableTitle}</th>
                <th className="px-4 py-3 text-right font-medium">Active accounts</th>
              </tr>
            </thead>
            <tbody>
              {managerRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No active accounts
                  </td>
                </tr>
              ) : (
                managerRows.map((r) => (
                  <tr key={r.name} className="border-t border-border/70 hover:bg-muted/30">
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
