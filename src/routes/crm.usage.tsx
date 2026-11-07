import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { getCrmUsageBoard, refreshCrmUsageAccount } from "@/lib/api";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import { eachIsoDay, usageFocus, usageTag, usageTagTone } from "@/lib/crm-usage";
import { cn } from "@/lib/utils";
import type { CrmUsageBoard, CrmUsageBoardRow } from "@/types/crm-usage";

const usageSearchSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const Route = createFileRoute("/crm/usage")({
  validateSearch: (search) => usageSearchSchema.parse(search),
  component: CrmUsageLayout,
});

type WindowId = "1" | "3" | "7" | "15" | "30" | "custom";
type CardId = "all" | "using" | "quiet" | "leads" | "error" | "disconnected" | "missing";

const WINDOWS: { id: Exclude<WindowId, "custom">; label: string }[] = [
  { id: "1", label: "Today" },
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "15", label: "15 days" },
  { id: "30", label: "30 days" },
];

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function rangeFor(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: isoDate(start), to: isoDate(end) };
}

function UsageStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-1.5 py-1">
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function needsFill(row: CrmUsageBoardRow) {
  return row.connected && (row.savedDays < row.expectedDays || row.failedDays > 0);
}

function CrmUsageLayout() {
  const isDetail = useRouterState({
    select: (s) => s.location.pathname.startsWith("/crm/usage/") && s.location.pathname !== "/crm/usage",
  });
  if (isDetail) return <Outlet />;
  return <CrmUsagePage />;
}

function CrmUsagePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const initial = search.from && search.to ? { from: search.from, to: search.to } : rangeFor(7);
  const [windowId, setWindowId] = useState<WindowId>("7");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [board, setBoard] = useState<CrmUsageBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [card, setCard] = useState<CardId>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    try {
      const next = await getCrmUsageBoard({ data: range });
      setBoard(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load saved usage");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ from, to });
  }, [from, to, load]);

  const rows = board?.rows ?? [];
  const statusOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.status))].sort();
    return [
      { value: "all", label: "All statuses" },
      ...values.map((status) => ({ value: status, label: crmAccountStatusLabel(status) })),
    ];
  }, [rows]);
  const managerOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.salesManagerName).filter(Boolean))].sort();
    return [
      { value: "all", label: "All managers" },
      { value: "unassigned", label: "Unassigned" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [rows]);

  const filtered = rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (managerFilter === "unassigned") return !row.salesManagerName;
    if (managerFilter !== "all" && row.salesManagerName !== managerFilter) return false;
    return true;
  });

  const counts = {
    all: filtered.length,
    using: filtered.filter((row) => row.summary?.ok && row.summary.hasCrmActivity).length,
    quiet: filtered.filter((row) => row.summary?.ok && !row.summary.hasCrmActivity).length,
    leads: filtered.filter((row) => row.summary?.ok && row.summary.leadOnly).length,
    error: filtered.filter((row) => row.summary && !row.summary.ok).length,
    disconnected: filtered.filter((row) => !row.connected).length,
    missing: filtered.filter(needsFill).length,
  };

  const visible = filtered.filter((row) => {
    if (card === "using") return Boolean(row.summary?.ok && row.summary.hasCrmActivity);
    if (card === "quiet") return Boolean(row.summary?.ok && !row.summary.hasCrmActivity);
    if (card === "leads") return Boolean(row.summary?.ok && row.summary.leadOnly);
    if (card === "error") return Boolean(row.summary && !row.summary.ok);
    if (card === "disconnected") return !row.connected;
    if (card === "missing") return needsFill(row);
    return true;
  });

  const tableRows = visible.map((row) => ({
    ...row,
    tag: row.summary ? usageTag(row.summary) : row.connected ? "Not saved" : "Not connected",
    focus: !row.connected
      ? "No Buildesk dashboard key on this account."
      : row.summary
        ? usageFocus(row.summary, row.licensedUsers)
        : "No saved days in this window. The nightly job stores yesterday. Fill missing days to load this range.",
    leads: row.summary?.ok ? row.summary.leads : -1,
    followups: row.summary?.ok ? row.summary.followups : -1,
    bookings: row.summary?.ok && row.summary.bookings != null ? row.summary.bookings : -1,
    calls: row.summary?.ok ? row.summary.calls : -1,
    activeUsers: row.summary?.ok ? row.summary.activeUsers : -1,
  }));

  async function fillMissing() {
    if (from > to) {
      toast.error("Start date must be on or before the end date");
      return;
    }
    const targets = rows.filter(needsFill);
    if (!targets.length) {
      toast.success("This window is already saved");
      return;
    }
    setFilling(true);
    setProgress({ done: 0, total: targets.length });
    const slices: { from: string; to: string }[] = [];
    const days = eachIsoDay(from, to);
    for (let index = 0; index < days.length; index += 5) {
      const slice = days.slice(index, index + 5);
      slices.push({ from: slice[0], to: slice[slice.length - 1] });
    }
    try {
      for (let index = 0; index < targets.length; index += 1) {
        for (const slice of slices) {
          await refreshCrmUsageAccount({
            data: { accountId: targets[index].id, ...slice, force: false },
          });
        }
        setProgress({ done: index + 1, total: targets.length });
      }
      await load({ from, to });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not fill missing days");
      await load({ from, to });
    } finally {
      setFilling(false);
    }
  }

  const cards: { id: CardId; label: string; value: number }[] = [
    { id: "all", label: "Accounts", value: counts.all },
    { id: "using", label: "Using CRM", value: counts.using },
    { id: "quiet", label: "No CRM activity", value: counts.quiet },
    { id: "leads", label: "Leads only", value: counts.leads },
    { id: "missing", label: "Missing days", value: counts.missing },
    { id: "error", label: "API errors", value: counts.error },
    { id: "disconnected", label: "Not connected", value: counts.disconnected },
  ];

  return (
    <PageWrap>
      <PageHeader
        title="Usage"
        actions={
          <Button size="sm" onClick={() => void fillMissing()} disabled={filling || loading}>
            {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {filling ? `${progress.done}/${progress.total}` : "Fill missing days"}
          </Button>
        }
      />
      <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
        Onboarding, Live, and Active accounts. Saved daily reports open immediately. Every night at
        12:10am IST, yesterday is fetched again and replaces the stored day. Lead receipt alone is not CRM use.
        {board?.sync?.message ? ` ${board.sync.message}` : ""}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {WINDOWS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={windowId === item.id ? "default" : "outline"}
            onClick={() => {
              const next = rangeFor(Number(item.id));
              setWindowId(item.id);
              setFrom(next.from);
              setTo(next.to);
              setCard("all");
            }}
          >
            {item.label}
          </Button>
        ))}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search account, city, or manager"
          className="h-8 min-w-[12rem] flex-1 rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <DesignTicketFilterBar className="mb-3">
        <DesignTicketDateField
          compact
          label="From"
          value={from}
          onChange={(value) => {
            setWindowId("custom");
            setFrom(value);
          }}
        />
        <DesignTicketDateField
          compact
          label="To"
          value={to}
          onChange={(value) => {
            setWindowId("custom");
            setTo(value);
          }}
        />
        <DesignTicketFilterField label="Status" compact>
          <DesignTicketSelect compact value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Sales manager" compact>
          <DesignTicketSelect compact value={managerFilter} onChange={setManagerFilter} options={managerOptions} />
        </DesignTicketFilterField>
      </DesignTicketFilterBar>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCard(item.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              card === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
            <div className="text-lg font-semibold tabular-nums">{loading ? "—" : item.value}</div>
          </button>
        ))}
      </div>

      <DataTable
        data={tableRows}
        density="compact"
        layout="fixed"
        hideSearch
        searchQuery={query}
        searchKeys={["name", "salesManagerName", "city", "tag", "focus"]}
        getRowId={(row) => row.id}
        onRowClick={(row) =>
          void navigate({
            to: "/crm/usage/$accountId",
            params: { accountId: row.id },
            search: { from, to },
          })
        }
        emptyState={
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading saved usage…" : "No accounts match these filters."}
          </div>
        }
        columns={[
          {
            key: "name",
            header: "Account",
            sortable: true,
            className: "w-[28%]",
            render: (row) => {
              const coverage = row.expectedDays > 0 ? Math.round((row.savedDays / row.expectedDays) * 100) : 0;
              return (
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {crmAccountStatusLabel(row.status)}
                    {row.city ? ` · ${row.city}` : ""}
                    {row.salesManagerName ? ` · ${row.salesManagerName}` : ""}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${coverage}%` }} />
                    </div>
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                      {row.savedDays}/{row.expectedDays}
                    </span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "leads",
            header: "Activity",
            sortable: true,
            className: "w-[42%]",
            render: (row) => (
              <div className="grid grid-cols-5 gap-1">
                <UsageStat label="Users" value={row.activeUsers >= 0 ? `${row.activeUsers}/${row.licensedUsers || "—"}` : "—"} />
                <UsageStat label="Leads" value={row.leads >= 0 ? row.leads : "—"} />
                <UsageStat label="Follow-ups" value={row.followups >= 0 ? row.followups : "—"} />
                <UsageStat label="Bookings" value={row.bookings >= 0 ? row.bookings : "—"} />
                <UsageStat label="Calls" value={row.calls >= 0 ? row.calls : "—"} />
              </div>
            ),
          },
          {
            key: "tag",
            header: "Usage",
            sortable: true,
            className: "w-[12%]",
            render: (row) => <Pill tone={usageTagTone(row.tag)}>{row.tag}</Pill>,
          },
          {
            key: "focus",
            header: "Customer success",
            className: "w-[18%]",
            render: (row) => <span className="block text-[11px] leading-snug text-muted-foreground">{row.focus}</span>,
          },
        ]}
      />
    </PageWrap>
  );
}
