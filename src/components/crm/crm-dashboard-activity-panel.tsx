import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

import { CrmActivityOpenLink } from "@/components/crm/crm-activity-open-link";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import {
  CRM_ACTIVITY_CATEGORY_LABEL,
  CRM_ACTIVITY_STATUS_LABEL,
  crmActivityExecutiveDisplay,
  filterCrmActivityItems,
  type CrmActivityCategory,
  type CrmActivityDateRange,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { ActivityKind } from "@/types";

const KIND_TONE: Record<ActivityKind, "success" | "warning" | "danger" | "muted"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "muted",
};

const ACTIVITY_FILTER_CHIPS = [
  { id: "all", label: "All" },
  { id: "follow_up", label: CRM_ACTIVITY_CATEGORY_LABEL.follow_up },
  { id: "visit", label: CRM_ACTIVITY_CATEGORY_LABEL.visit },
  { id: "communication", label: CRM_ACTIVITY_CATEGORY_LABEL.communication },
  { id: "booking", label: CRM_ACTIVITY_CATEGORY_LABEL.booking },
  { id: "tracker", label: CRM_ACTIVITY_CATEGORY_LABEL.tracker },
  { id: "account", label: CRM_ACTIVITY_CATEGORY_LABEL.account },
  { id: "module", label: CRM_ACTIVITY_CATEGORY_LABEL.module },
  { id: "support", label: CRM_ACTIVITY_CATEGORY_LABEL.support },
  { id: "ticket", label: CRM_ACTIVITY_CATEGORY_LABEL.ticket },
  { id: "query", label: CRM_ACTIVITY_CATEGORY_LABEL.query },
] as const satisfies ReadonlyArray<{ id: CrmActivityCategory; label: string }>;

type ActivityFilterTone = "muted" | "warning" | "success" | "info" | "danger";

const ACTIVITY_FILTER_BOX_COUNT_TONE: Record<ActivityFilterTone, string> = {
  muted: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  danger: "text-destructive",
};

function activityFilterChipTone(id: CrmActivityCategory): ActivityFilterTone {
  if (id === "follow_up") return "info";
  if (id === "visit") return "success";
  if (id === "booking") return "warning";
  if (id === "ticket" || id === "support") return "danger";
  if (id === "query") return "warning";
  return "muted";
}

type Props = {
  items: CrmActivityItem[];
};

export function CrmDashboardActivityPanel({ items }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [category, setCategory] = useState<CrmActivityCategory>("all");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateRange, setDateRange] = useState<CrmActivityDateRange>("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.accountId && item.accountName) {
        map.set(item.accountId, item.accountName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const toolbarFilters = useMemo(
    () => ({
      kind,
      query: tableSearch,
      accountId: accountFilter,
      dateRange: (dateFrom || dateTo ? "all" : dateRange) as CrmActivityDateRange,
      dateFrom,
      dateTo,
    }),
    [kind, tableSearch, accountFilter, dateRange, dateFrom, dateTo],
  );

  const toolbarScoped = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category: "all",
        ...toolbarFilters,
      }),
    [items, toolbarFilters],
  );

  const filtered = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category,
        ...toolbarFilters,
      }),
    [items, category, toolbarFilters],
  );

  function activityFilterChipCount(id: CrmActivityCategory) {
    if (id === "all") return toolbarScoped.length;
    return toolbarScoped.filter((item) => item.category === id).length;
  }

  const last7DaysCount = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category: "all",
        kind,
        query: tableSearch,
        accountId: accountFilter,
        dateRange: "7d",
      }).length,
    [items, kind, tableSearch, accountFilter],
  );

  const activeFilterCount = [
    category !== "all",
    kind !== "all",
    accountFilter !== "all",
    dateRange !== "30d",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  function clearFilters() {
    setTableSearch("");
    setCategory("all");
    setKind("all");
    setAccountFilter("all");
    setDateRange("30d");
    setDateFrom("");
    setDateTo("");
  }

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showLast7Days() {
    setDateRange("7d");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Activity history</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div
            role="tablist"
            aria-label="Activity categories"
            className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5"
          >
            {ACTIVITY_FILTER_CHIPS.map((chip) => {
              const tone = activityFilterChipTone(chip.id);
              const active = category === chip.id;
              const count = activityFilterChipCount(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(chip.id)}
                  className={cn(
                    "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                    "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/80",
                  )}
                >
                  <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {chip.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-lg font-semibold tabular-nums leading-none",
                      ACTIVITY_FILTER_BOX_COUNT_TONE[tone],
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={showLast7Days}
            className={cn(
              "flex shrink-0 flex-col justify-center rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-all lg:min-w-[5.5rem]",
              "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              dateRange === "7d" && !dateFrom && !dateTo
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/80",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Last 7 days
            </span>
            <span className="mt-1 text-lg font-semibold tabular-nums leading-none text-primary">
              {last7DaysCount}
            </span>
          </button>
        </div>
      </div>

      <div className="-mx-3 sm:-mx-4 lg:-mx-5">
        <div className="px-3 sm:px-4 lg:px-5">
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-4"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            onApply={applyFilters}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "activity" : "activities"}
            trailing={
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search activity, account, user…"
                  aria-label="Search activity"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
            <DesignTicketFilterField label="Account" compact>
              <DesignTicketSelect
                compact
                value={accountFilter}
                onChange={setAccountFilter}
                options={[
                  { value: "all", label: "All accounts" },
                  ...accountOptions.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={kind}
                onChange={(v) => setKind(v as ActivityKind | "all")}
                options={[
                  { value: "all", label: "All statuses" },
                  ...Object.entries(CRM_ACTIVITY_STATUS_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Quick range" compact>
              <DesignTicketSelect
                compact
                value={dateRange}
                onChange={(v) => setDateRange(v as CrmActivityDateRange)}
                options={[
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "90d", label: "Last 90 days" },
                  { value: "all", label: "All time" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              label="From"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From"
            />
            <DesignTicketDateField
              compact
              label="To"
              value={dateTo}
              onChange={setDateTo}
              placeholder="To"
            />
          </DesignTicketFilterBar>
        </div>

        <div ref={tableRef} className="min-w-0">
          {filtered.length === 0 ? (
            <div className="px-3 sm:px-4 lg:px-5">
              <EmptyState
                title="No activity matches your filters"
                description="Adjust category, account, status, date, or search terms."
                actionLabel={
                  activeFilterCount > 0 || tableSearch ? "Clear filters" : undefined
                }
                onAction={activeFilterCount > 0 || tableSearch ? clearFilters : undefined}
              />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
            >
              <DataTable
                flush
                data={filtered}
                hideSearch
                pageSize={25}
                density="compact"
                initialSortKey="createdAt"
                initialSortDir="desc"
                getRowId={(row) => row.id}
                columns={[
                  {
                    key: "createdAt",
                    header: "Date",
                    sortable: true,
                    render: (row) => (
                      <span className="whitespace-nowrap text-xs font-medium">
                        {formatDate(row.createdAt)}
                      </span>
                    ),
                  },
                  {
                    key: "time",
                    header: "Time",
                    render: (row) => (
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {formatTime(row.createdAt)}
                      </span>
                    ),
                  },
                  {
                    key: "category",
                    header: "Type",
                    sortable: true,
                    render: (row) => (
                      <Pill tone="muted" className="text-[10px]">
                        {CRM_ACTIVITY_CATEGORY_LABEL[row.category]}
                      </Pill>
                    ),
                  },
                  {
                    key: "kind",
                    header: "Status",
                    sortable: true,
                    render: (row) => (
                      <Pill tone={KIND_TONE[row.kind]}>{CRM_ACTIVITY_STATUS_LABEL[row.kind]}</Pill>
                    ),
                  },
                  {
                    key: "remarks",
                    header: "Activity / remarks",
                    sortable: true,
                    render: (row) => (
                      <div className="min-w-[12rem] max-w-[320px]">
                        <div className="text-xs font-medium">{row.what}</div>
                        {row.remarks && row.remarks !== row.what ? (
                          <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                            {row.remarks}
                          </div>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    key: "accountName",
                    header: "Account",
                    sortable: true,
                    render: (row) =>
                      row.accountId ? (
                        <Link
                          to="/crm/accounts/$accountId"
                          params={{ accountId: row.accountId }}
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.accountName ?? "Account"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      ),
                  },
                  {
                    key: "executive",
                    header: "User",
                    sortable: true,
                    render: (row) => (
                      <span className="text-xs">{crmActivityExecutiveDisplay(row)}</span>
                    ),
                  },
                  {
                    key: "teamExecutive",
                    header: "Executive",
                    sortable: true,
                    render: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {row.teamExecutive?.trim() || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "teamSalesManager",
                    header: "Sales mgr",
                    sortable: true,
                    render: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {row.teamSalesManager?.trim() || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "leadContact",
                    header: "Lead / contact",
                    sortable: true,
                    render: (row) => (
                      <span className="text-xs">{row.leadContact?.trim() || "—"}</span>
                    ),
                  },
                  {
                    key: "nextFollowUp",
                    header: "Next follow-up",
                    sortable: true,
                    render: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {row.nextFollowUp ? formatDate(row.nextFollowUp) : "—"}
                      </span>
                    ),
                  },
                  {
                    key: "open",
                    header: "",
                    render: (row) => (
                      <div onClick={(e) => e.stopPropagation()}>
                        <CrmActivityOpenLink item={row} />
                      </div>
                    ),
                  },
                ]}
              />
            </motion.div>
          )}
        </div>
      </div>
    </PageWrap>
  );
}
