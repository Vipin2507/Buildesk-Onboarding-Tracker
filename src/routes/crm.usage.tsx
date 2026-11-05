import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmUsageDetailSheet } from "@/components/crm/crm-usage-detail-sheet";
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
import {
  getCrmUsageDays,
  getCrmUsageDetail,
  listCrmUsageAccounts,
  scanCrmUsage,
} from "@/lib/api";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import { chunkIds, usageFocus, usageTag, usageTagTone } from "@/lib/crm-usage";
import { cn } from "@/lib/utils";
import type {
  CrmUsageAccount,
  CrmUsageDay,
  CrmUsageDetail,
  CrmUsageScanRow,
} from "@/types/crm-usage";

export const Route = createFileRoute("/crm/usage")({
  component: CrmUsagePage,
});

type WindowId = "1" | "3" | "7" | "15" | "30" | "custom";
type CardId = "all" | "using" | "quiet" | "leads" | "error" | "disconnected";

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

function shiftIso(iso: string, delta: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return isoDate(date);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function CrmUsagePage() {
  const initial = rangeFor(7);
  const [accounts, setAccounts] = useState<CrmUsageAccount[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [windowId, setWindowId] = useState<WindowId>("7");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loadedRange, setLoadedRange] = useState("");
  const [scans, setScans] = useState<Record<string, CrmUsageScanRow>>({});
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [card, setCard] = useState<CardId>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmUsageDetail | null>(null);
  const [days, setDays] = useState<CrmUsageDay[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCrmUsageAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not load accounts");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rangeKey = `${from}|${to}`;
  const scanReady = loadedRange === rangeKey;

  const statusOptions = useMemo(() => {
    const values = [...new Set(accounts.map((account) => account.status))].sort();
    return [
      { value: "all", label: "All statuses" },
      ...values.map((status) => ({ value: status, label: crmAccountStatusLabel(status) })),
    ];
  }, [accounts]);

  const managerOptions = useMemo(() => {
    const names = [...new Set(accounts.map((account) => account.salesManagerName).filter(Boolean))].sort();
    return [
      { value: "all", label: "All managers" },
      { value: "unassigned", label: "Unassigned" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [accounts]);

  const rows = useMemo(() => {
    return accounts
      .filter((account) => statusFilter === "all" || account.status === statusFilter)
      .filter((account) => {
        if (managerFilter === "all") return true;
        if (managerFilter === "unassigned") return !account.salesManagerName;
        return account.salesManagerName === managerFilter;
      })
      .map((account) => {
        const scan = scanReady ? scans[account.id] ?? null : null;
        return {
          ...account,
          scan,
          activeUsers: scan?.ok ? scan.activeUsers : 0,
          leads: scan?.ok ? scan.leads : 0,
          followups: scan?.ok ? scan.followups : 0,
          visits: scan?.ok ? scan.visitsConducted : 0,
          bookings: scan?.ok && scan.bookings != null ? scan.bookings : -1,
          calls: scan?.ok ? scan.calls : 0,
          connectedCalls: scan?.ok ? scan.connectedCalls : 0,
          tag: usageTag(scan),
          focus: usageFocus(scan, account.licensedUsers),
        };
      });
  }, [accounts, scans, scanReady, statusFilter, managerFilter]);

  const counts = useMemo(() => {
    const scanned = rows.filter((row) => row.scan);
    return {
      all: rows.length,
      using: scanned.filter((row) => row.scan?.ok && row.scan.hasCrmActivity).length,
      quiet: scanned.filter((row) => row.scan?.ok && !row.scan.hasCrmActivity).length,
      leads: scanned.filter((row) => row.scan?.ok && row.scan.leadOnly).length,
      error: scanned.filter((row) => row.scan && row.scan.connected && !row.scan.ok).length,
      disconnected: rows.filter((row) => !row.connected).length,
    };
  }, [rows]);

  const visible = rows.filter((row) => {
    if (card === "disconnected") return !row.connected;
    if (card === "using") return Boolean(row.scan?.ok && row.scan.hasCrmActivity);
    if (card === "quiet") return Boolean(row.scan?.ok && !row.scan.hasCrmActivity);
    if (card === "leads") return Boolean(row.scan?.ok && row.scan.leadOnly);
    if (card === "error") return Boolean(row.scan && row.scan.connected && !row.scan.ok);
    return true;
  });

  function applyWindow(id: Exclude<WindowId, "custom">) {
    const next = rangeFor(Number(id));
    setWindowId(id);
    setFrom(next.from);
    setTo(next.to);
    setCard("all");
  }

  async function refresh() {
    if (from > to) {
      toast.error("Start date must be on or before the end date");
      return;
    }
    const targets = accounts.filter((account) => account.connected).map((account) => account.id);
    if (!targets.length) {
      toast.error("No accounts have a Buildesk API key");
      return;
    }
    setScanning(true);
    setScanProgress({ done: 0, total: targets.length });
    const next: Record<string, CrmUsageScanRow> = {};
    try {
      for (const batch of chunkIds(targets, 8)) {
        const result = await scanCrmUsage({ data: { accountIds: batch, from, to } });
        for (const row of result) next[row.accountId] = row;
        setScans({ ...next });
        setLoadedRange(rangeKey);
        setScanProgress({ done: Object.keys(next).length, total: targets.length });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setScanning(false);
    }
  }

  async function openAccount(accountId: string) {
    setSelectedId(accountId);
    setDetail(null);
    setDays(null);
    const account = accounts.find((item) => item.id === accountId);
    if (!account?.connected) return;
    setLoadingDetail(true);
    try {
      const result = await getCrmUsageDetail({ data: { accountId, from, to } });
      setDetail(result);
      setScans((current) => ({ ...current, [accountId]: result }));
      setLoadedRange(rangeKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this account");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadDays() {
    if (!selectedId) return;
    const dayFrom = from < shiftIso(to, -30) ? shiftIso(to, -30) : from;
    setLoadingDays(true);
    try {
      const result = await getCrmUsageDays({ data: { accountId: selectedId, from: dayFrom, to } });
      setDays(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the daily pattern");
    } finally {
      setLoadingDays(false);
    }
  }

  function exportCsv() {
    const header = [
      "Account",
      "Status",
      "Manager",
      "Licensed users",
      "Active users",
      "Leads",
      "Follow-ups",
      "Visits conducted",
      "Bookings",
      "Calls",
      "Connected calls",
      "Tag",
      "Focus",
    ];
    const lines = [
      header.join(","),
      ...visible.map((row) =>
        [
          row.name,
          crmAccountStatusLabel(row.status),
          row.salesManagerName,
          row.licensedUsers,
          row.scan?.ok ? row.activeUsers : "",
          row.scan?.ok ? row.leads : "",
          row.scan?.ok ? row.followups : "",
          row.scan?.ok ? row.visits : "",
          row.scan?.ok && row.bookings >= 0 ? row.bookings : "",
          row.scan?.ok ? row.calls : "",
          row.scan?.ok ? row.connectedCalls : "",
          row.tag,
          row.focus,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crm-usage-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const cards: { id: CardId; label: string; value: number }[] = [
    { id: "all", label: "Accounts", value: counts.all },
    { id: "using", label: "Using CRM", value: counts.using },
    { id: "quiet", label: "No CRM activity", value: counts.quiet },
    { id: "leads", label: "Leads only", value: counts.leads },
    { id: "error", label: "API errors", value: counts.error },
    { id: "disconnected", label: "Not connected", value: counts.disconnected },
  ];

  return (
    <PageWrap>
      <PageHeader
        title="Usage"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => void refresh()} disabled={scanning || loadingList}>
              {scanning ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {scanning ? `${scanProgress.done}/${scanProgress.total}` : "Refresh analysis"}
            </Button>
          </>
        }
      />
      <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
        Reads each account’s Buildesk activity, call, and booking reports for the dates you pick.
        Lead receipt alone is not treated as CRM use. Booking failures stay as warnings instead of a
        confirmed zero.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {WINDOWS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={windowId === item.id ? "default" : "outline"}
            onClick={() => applyWindow(item.id)}
          >
            {item.label}
          </Button>
        ))}
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
          <DesignTicketSelect
            compact
            value={managerFilter}
            onChange={setManagerFilter}
            options={managerOptions}
          />
        </DesignTicketFilterField>
      </DesignTicketFilterBar>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
            <div className="text-lg font-semibold tabular-nums">{scanReady || item.id === "all" || item.id === "disconnected" ? item.value : "—"}</div>
          </button>
        ))}
      </div>

      <DataTable
        data={visible}
        density="compact"
        searchKeys={["name", "salesManagerName", "city", "tag", "focus"]}
        getRowId={(row) => row.id}
        onRowClick={(row) => void openAccount(row.id)}
        emptyState={
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {loadingList ? "Loading accounts…" : "No accounts match these filters."}
          </div>
        }
        columns={[
          {
            key: "name",
            header: "Account",
            sortable: true,
            render: (row) => (
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {crmAccountStatusLabel(row.status)}
                  {row.city ? ` · ${row.city}` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "salesManagerName",
            header: "Manager",
            sortable: true,
            render: (row) => row.salesManagerName || "—",
          },
          {
            key: "licensedUsers",
            header: "Users",
            sortable: true,
            render: (row) =>
              row.scan?.ok ? `${row.activeUsers}/${row.licensedUsers || "—"}` : row.licensedUsers || "—",
          },
          {
            key: "leads",
            header: "Leads",
            sortable: true,
            render: (row) => (row.scan?.ok ? row.leads : "—"),
          },
          {
            key: "followups",
            header: "Follow-ups",
            sortable: true,
            render: (row) => (row.scan?.ok ? row.followups : "—"),
          },
          {
            key: "visits",
            header: "Visits",
            sortable: true,
            render: (row) => (row.scan?.ok ? `${row.scan.visitsConducted}/${row.scan.visitsScheduled}` : "—"),
          },
          {
            key: "bookings",
            header: "Bookings",
            sortable: true,
            render: (row) => (row.scan?.ok ? (row.bookings >= 0 ? row.bookings : "—") : "—"),
          },
          {
            key: "calls",
            header: "Calls",
            sortable: true,
            render: (row) => (row.scan?.ok ? row.calls : "—"),
          },
          {
            key: "tag",
            header: "Usage",
            sortable: true,
            render: (row) => <Pill tone={usageTagTone(row.tag)}>{row.tag}</Pill>,
          },
          {
            key: "focus",
            header: "Customer success",
            render: (row) => (
              <span className="block max-w-xs text-xs text-muted-foreground">{row.focus}</span>
            ),
          },
        ]}
      />

      <CrmUsageDetailSheet
        account={selected}
        scan={selected && scanReady ? scans[selected.id] ?? null : null}
        detail={detail}
        days={days}
        from={from}
        to={to}
        loadingDetail={loadingDetail}
        loadingDays={loadingDays}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
            setDays(null);
          }
        }}
        onLoadDays={() => void loadDays()}
      />
    </PageWrap>
  );
}
