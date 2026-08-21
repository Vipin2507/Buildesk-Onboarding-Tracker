import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { DataTable } from "@/components/data-table";
import { ListToolbar } from "@/components/list-toolbar";
import { Pill } from "@/components/status-pill";
import {
  countCrmActivityByCategory,
  CRM_ACTIVITY_CATEGORY_LABEL,
  CRM_ACTIVITY_STATUS_LABEL,
  filterCrmActivityItems,
  listCrmActivityExecutiveNames,
  listCrmActivityLeadContactNames,
  type CrmActivityAccountMeta,
  type CrmActivityCategory,
  type CrmActivityDateRange,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ActivityKind } from "@/types";

const KIND_TONE: Record<ActivityKind, "success" | "warning" | "danger" | "muted"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "muted",
};

type Props = {
  items: CrmActivityItem[];
  accounts: CrmActivityAccountMeta[];
};

export function CrmDashboardActivityPanel({ items, accounts }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CrmActivityCategory>("all");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [accountId, setAccountId] = useState("all");
  const [executiveFilter, setExecutiveFilter] = useState("all");
  const [leadContactFilter, setLeadContactFilter] = useState("all");
  const [dateRange, setDateRange] = useState<CrmActivityDateRange>("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const categoryCounts = useMemo(() => countCrmActivityByCategory(items), [items]);

  const executiveOptions = useMemo(
    () => [
      { value: "all", label: "All executives" },
      ...listCrmActivityExecutiveNames(items).map((name) => ({ value: name, label: name })),
    ],
    [items],
  );

  const leadContactOptions = useMemo(
    () => [
      { value: "all", label: "All leads / contacts" },
      ...listCrmActivityLeadContactNames(items).map((name) => ({ value: name, label: name })),
    ],
    [items],
  );

  const accountOptions = useMemo(
    () => [
      { value: "all", label: "All accounts" },
      ...[...accounts]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [accounts],
  );

  const filtered = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category,
        accountId,
        kind,
        query,
        dateRange: dateFrom || dateTo ? "all" : dateRange,
        executiveFilter,
        leadContactFilter,
        dateFrom,
        dateTo,
      }),
    [
      items,
      category,
      accountId,
      kind,
      query,
      dateRange,
      dateFrom,
      dateTo,
      executiveFilter,
      leadContactFilter,
    ],
  );

  const activeFilterCount = [
    category !== "all",
    kind !== "all",
    accountId !== "all",
    executiveFilter !== "all",
    leadContactFilter !== "all",
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
    setAccountId("all");
    setExecutiveFilter("all");
    setLeadContactFilter("all");
    setDateRange("30d");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-2.5">
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search activity, account, executive, lead, or remarks…"
        chips={categoryChips}
        activeChip={category}
        onChipChange={(id) => setCategory(id as CrmActivityCategory)}
        defaultFiltersOpen
        dateRange={{
          label: "Activity date",
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        selects={[
          {
            id: "type",
            label: "Activity type",
            value: category,
            options: [
              { value: "all", label: "All types" },
              ...Object.entries(CRM_ACTIVITY_CATEGORY_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ],
            onChange: (v) => setCategory(v as CrmActivityCategory),
          },
          {
            id: "status",
            label: "Activity status",
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
            id: "executive",
            label: "User / executive",
            value: executiveFilter,
            options: executiveOptions,
            onChange: setExecutiveFilter,
          },
          {
            id: "lead",
            label: "Lead / contact",
            value: leadContactFilter,
            options: leadContactOptions,
            onChange: setLeadContactFilter,
          },
          {
            id: "account",
            label: "Account",
            value: accountId,
            options: accountOptions,
            onChange: setAccountId,
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
        onClear={clearFilters}
      />

      <DataTable
        data={filtered}
        hideSearch
        pageSize={20}
        density="compact"
        initialSortKey="createdAt"
        initialSortDir="desc"
        getRowId={(row) => row.id}
        emptyState={
          <div className="card-soft flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No activity matches your filters</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Adjust date, activity type, status, executive, or lead/contact filters to see CRM
              activity history.
            </p>
          </div>
        }
        columns={[
          {
            key: "createdAt",
            header: "Date / time",
            sortable: true,
            render: (row) => (
              <div className="whitespace-nowrap">
                <div className="font-medium">{formatDate(row.createdAt)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDateTime(row.createdAt).split(", ").pop()}
                </div>
              </div>
            ),
          },
          {
            key: "executive",
            header: "Executive",
            sortable: true,
            render: (row) => (
              <span className="text-xs">{row.executive?.trim() || row.who || "—"}</span>
            ),
          },
          {
            key: "category",
            header: "Activity type",
            sortable: true,
            render: (row) => (
              <span className="text-xs">{CRM_ACTIVITY_CATEGORY_LABEL[row.category]}</span>
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
            key: "kind",
            header: "Status",
            sortable: true,
            render: (row) => (
              <Pill tone={KIND_TONE[row.kind]}>{CRM_ACTIVITY_STATUS_LABEL[row.kind]}</Pill>
            ),
          },
          {
            key: "remarks",
            header: "Remarks / details",
            sortable: true,
            render: (row) => (
              <div className="max-w-[240px]">
                <div className="line-clamp-2 text-xs font-medium">{row.remarks ?? row.what}</div>
                {row.accountName ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{row.accountName}</div>
                ) : null}
              </div>
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
        ]}
      />
    </div>
  );
}
