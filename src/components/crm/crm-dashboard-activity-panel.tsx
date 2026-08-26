import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CrmActivityOpenLink } from "@/components/crm/crm-activity-open-link";
import { DataTable } from "@/components/data-table";
import { ListToolbar } from "@/components/list-toolbar";
import { Pill } from "@/components/status-pill";
import {
  countCrmActivityByCategory,
  CRM_ACTIVITY_CATEGORY_LABEL,
  CRM_ACTIVITY_STATUS_LABEL,
  crmActivityExecutiveDisplay,
  filterCrmActivityItems,
  type CrmActivityCategory,
  type CrmActivityDateRange,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";
import { formatDate, formatTime } from "@/lib/utils";
import type { ActivityKind } from "@/types";

const KIND_TONE: Record<ActivityKind, "success" | "warning" | "danger" | "muted"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "muted",
};

type Props = {
  items: CrmActivityItem[];
};

export function CrmDashboardActivityPanel({ items }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CrmActivityCategory>("all");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateRange, setDateRange] = useState<CrmActivityDateRange>("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const categoryCounts = useMemo(() => countCrmActivityByCategory(items), [items]);

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

  const filtered = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category,
        kind,
        query,
        accountId: accountFilter,
        dateRange: dateFrom || dateTo ? "all" : dateRange,
        dateFrom,
        dateTo,
      }),
    [items, category, kind, query, accountFilter, dateRange, dateFrom, dateTo],
  );

  const activeFilterCount = [
    category !== "all",
    kind !== "all",
    accountFilter !== "all",
    dateRange !== "30d",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const categoryChips = useMemo(
    () =>
      (
        [
          { id: "all" as const, label: "All activity" },
          { id: "follow_up" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.follow_up },
          { id: "visit" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.visit },
          { id: "communication" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.communication },
          { id: "booking" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.booking },
          { id: "tracker" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.tracker },
          { id: "account" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.account },
          { id: "module" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.module },
          { id: "support" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.support },
          { id: "ticket" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.ticket },
        ] as const
      ).map((c) => ({
        id: c.id,
        label: c.label,
        count: categoryCounts[c.id],
      })),
    [categoryCounts],
  );

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setKind("all");
    setAccountFilter("all");
    setDateRange("30d");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-2.5">
      <ListToolbar
        compact
        chipsAlwaysVisible
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search activity, account, user, or contact…"
        chips={categoryChips}
        activeChip={category}
        onChipChange={(id) => setCategory(id as CrmActivityCategory)}
        dateRange={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        selects={[
          {
            id: "account",
            label: "Account",
            value: accountFilter,
            options: [
              { value: "all", label: "All accounts" },
              ...accountOptions.map((a) => ({ value: a.id, label: a.name })),
            ],
            onChange: setAccountFilter,
          },
          {
            id: "status",
            label: "Status",
            value: kind,
            options: [
              { value: "all", label: "All statuses" },
              ...Object.entries(CRM_ACTIVITY_STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ],
            onChange: (v) => setKind(v as ActivityKind | "all"),
          },
          {
            id: "range",
            label: "Quick range",
            value: dateRange,
            options: [
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "all", label: "All time" },
            ],
            onChange: (v) => setDateRange(v as CrmActivityDateRange),
          },
        ]}
        resultCount={filtered.length}
        resultLabel="activities"
        activeFilterCount={activeFilterCount}
        onClear={activeFilterCount > 0 || query ? clearFilters : undefined}
      />

      <DataTable
        data={filtered}
        hideSearch
        pageSize={25}
        density="compact"
        initialSortKey="createdAt"
        initialSortDir="desc"
        getRowId={(row) => row.id}
        emptyState={
          <div className="card-soft flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No activity matches your filters</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Adjust category, account, status, date, or search terms.
            </p>
          </div>
        }
        columns={[
          {
            key: "createdAt",
            header: "Date",
            sortable: true,
            render: (row) => (
              <span className="whitespace-nowrap text-xs font-medium">{formatDate(row.createdAt)}</span>
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
    </div>
  );
}
