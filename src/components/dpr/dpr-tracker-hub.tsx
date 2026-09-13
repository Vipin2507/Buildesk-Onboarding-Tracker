import { useMemo, useState } from "react";
import { Download, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { DprStatStrip } from "@/components/dpr/dpr-stat-strip";
import { DprStatusBadge } from "@/components/dpr/dpr-status-badge";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dprSubcategoriesForCategory } from "@/data/dpr-catalog";
import {
  useDprCategories,
  useDprCompliance,
  useDprEntries,
  useDprSummary,
  useRemindDprCompliance,
} from "@/hooks/use-dpr";
import type { DprTrackerSearch } from "@/lib/dpr-tracker-search";
import { dprTrackerSearchToApiFilters } from "@/lib/dpr-tracker-search";
import { downloadCsv } from "@/lib/reports";
import { formatDate } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import type { DprEntry } from "@/types/dpr";
import { formatDprTimeRange } from "@/lib/dpr-time";
import { isDprFollowUpOverdue, todayIsoDate } from "@/lib/dpr-utils";

type Props = {
  search: DprTrackerSearch;
  onSearchChange: (patch: Partial<DprTrackerSearch>) => void;
};

export function DprTrackerHub({ search, onSearchChange }: Props) {
  const filters = useMemo(() => dprTrackerSearchToApiFilters(search), [search]);
  const complianceDate = filters.dateFrom ?? todayIsoDate();

  const { data: categories } = useDprCategories();
  const { data: listData, isLoading } = useDprEntries(filters);
  const { data: summary } = useDprSummary(filters);
  const { data: compliance } = useDprCompliance(complianceDate);
  const remind = useRemindDprCompliance(complianceDate);
  const users = useUserStore((s) => s.users);

  const [detail, setDetail] = useState<DprEntry | null>(null);
  const [selectedExecs, setSelectedExecs] = useState<Set<string>>(() => new Set());
  const tab = search.tab ?? "entries";

  const entries = listData?.items ?? [];
  const notSubmitted =
    compliance?.executives.filter((e) => !e.hasSubmitted) ?? [];

  const subcategories = useMemo(
    () => dprSubcategoriesForCategory(categories, search.category ?? ""),
    [categories, search.category],
  );

  const stats = [
    { id: "total", label: "Total tasks", value: summary?.totalEntries ?? 0 },
    {
      id: "rate",
      label: "Completion rate",
      value: `${summary?.completionRatePercent ?? 100}%`,
      tone: "success" as const,
    },
    {
      id: "od",
      label: "Overdue follow-ups",
      value: summary?.overdueFollowUpCount ?? 0,
      tone: (summary?.overdueFollowUpCount ?? 0) > 0 ? ("danger" as const) : ("default" as const),
    },
    {
      id: "ns",
      label: "DPR not submitted",
      value: notSubmitted.length,
      tone: notSubmitted.length > 0 ? ("danger" as const) : ("default" as const),
    },
  ];

  const rollup = useMemo(() => {
    const byExec = new Map<string, { name: string; total: number; done: number }>();
    for (const e of entries) {
      const cur = byExec.get(e.executiveId) ?? {
        name: e.executiveName ?? e.executiveId,
        total: 0,
        done: 0,
      };
      cur.total += 1;
      if (e.status === "Completed") cur.done += 1;
      byExec.set(e.executiveId, cur);
    }
    return [...byExec.values()]
      .map((r) => ({
        ...r,
        rate: r.total === 0 ? 100 : Math.round((r.done / r.total) * 100),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  function exportCsv() {
    downloadCsv(
      `dpr-tracker-${filters.dateFrom}-${filters.dateTo}.csv`,
      [
        { key: "executive", label: "Executive" },
        { key: "category", label: "Category" },
        { key: "task", label: "Task" },
        { key: "client", label: "Client" },
        { key: "status", label: "Status" },
        { key: "followUp", label: "Follow-up" },
      ],
      entries.map((e) => ({
        executive: e.executiveName ?? "",
        category: e.category,
        task: e.taskName,
        client: e.clientDisplayName ?? "",
        status: e.status,
        followUp: e.nextFollowUpDate ?? "",
      })),
    );
  }

  async function sendReminders() {
    const ids =
      selectedExecs.size > 0
        ? [...selectedExecs]
        : notSubmitted.map((e) => e.executiveId);
    if (ids.length === 0) {
      toast.message("No executives selected");
      return;
    }
    try {
      const res = await remind.mutateAsync(ids);
      toast.success(`Reminded ${res.notified} executive(s)`);
      setSelectedExecs(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reminder failed");
    }
  }

  return (
    <div className="space-y-4">
      <DesignTicketPageHeader
        title="DPR Tracker"
        subtitle="Team-wide daily progress, compliance, and follow-ups."
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />

      <DprStatStrip items={stats} />

      <div className="flex flex-wrap gap-2">
        <Input
          className="h-8 min-w-[140px] flex-1 text-xs"
          placeholder="Search task or client…"
          value={search.q ?? ""}
          onChange={(e) => onSearchChange({ q: e.target.value || undefined })}
        />
        <Select
          value={search.executiveIds?.split(",")[0] ?? "all"}
          onValueChange={(v) =>
            onSearchChange({ executiveIds: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Executive" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All executives</SelectItem>
            {users
              .filter((u) => u.active !== false && (u.productScope || "erp") === "erp")
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={search.category ?? "all"}
          onValueChange={(v) =>
            onSearchChange({ category: v === "all" ? undefined : v, subcategory: undefined })
          }
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories &&
              Object.keys(categories).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={search.subcategory ?? "all"}
          onValueChange={(v) => onSearchChange({ subcategory: v === "all" ? undefined : v })}
          disabled={!search.category}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Subcategory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subcategories</SelectItem>
            {subcategories.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-8 w-[130px] text-xs"
          value={search.dateFrom ?? complianceDate}
          onChange={(e) => onSearchChange({ dateFrom: e.target.value, dateTo: e.target.value })}
        />
      </div>

      <DesignTicketTabNav
        compact
        tabs={[
          { id: "entries", label: "Entries" },
          { id: "rollup", label: "By executive" },
        ]}
        activeId={tab}
        onChange={(id) => onSearchChange({ tab: id as "entries" | "rollup" })}
      />

      {notSubmitted.length > 0 ? (
        <DesignTicketSection title="Compliance">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {notSubmitted.length} executive(s) with no DPR on {formatDate(complianceDate)}
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1 text-xs"
              disabled={remind.isPending}
              onClick={() => void sendReminders()}
            >
              <Send className="h-3 w-3" /> Send reminder
            </Button>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {notSubmitted.map((e) => (
              <li key={e.executiveId} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedExecs.has(e.executiveId)}
                  onChange={(ev) => {
                    setSelectedExecs((prev) => {
                      const next = new Set(prev);
                      if (ev.target.checked) next.add(e.executiveId);
                      else next.delete(e.executiveId);
                      return next;
                    });
                  }}
                />
                <span className="font-medium">{e.name}</span>
                <span className="text-muted-foreground">{e.role}</span>
              </li>
            ))}
          </ul>
        </DesignTicketSection>
      ) : null}

      {tab === "rollup" ? (
        <DataTable
          data={rollup}
          getRowId={(r) => r.name}
          columns={[
            { key: "name", header: "Executive", sortable: true, render: (r) => r.name },
            { key: "total", header: "Tasks", sortable: true, render: (r) => r.total },
            { key: "done", header: "Completed", render: (r) => r.done },
            { key: "rate", header: "Rate %", render: (r) => `${r.rate}%` },
          ]}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Executive</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer border-b hover:bg-muted/20"
                  onClick={() => setDetail(e)}
                >
                  <td className="px-3 py-2">{e.executiveName}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2 font-medium">{e.taskName}</td>
                  <td className="px-3 py-2">{e.clientDisplayName ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDprTimeRange(e.startTime, e.endTime)}
                  </td>
                  <td className="px-3 py-2">
                    <DprStatusBadge status={e.status} />
                  </td>
                  <td className="px-3 py-2">
                    {isDprFollowUpOverdue(e.nextFollowUpDate, e.status) ? (
                      <span className="text-destructive">
                        Overdue · {formatDate(e.nextFollowUpDate)}
                      </span>
                    ) : e.nextFollowUpDate ? (
                      formatDate(e.nextFollowUpDate)
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.taskName}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <Label className="text-muted-foreground">Executive</Label>
                  <p>{detail.executiveName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p>
                    {detail.category} · {detail.subcategory}
                  </p>
                </div>
                {detail.taskDescription ? (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="whitespace-pre-wrap">{detail.taskDescription}</p>
                  </div>
                ) : null}
                {detail.remarks ? (
                  <div>
                    <Label className="text-muted-foreground">Remarks</Label>
                    <p>{detail.remarks}</p>
                  </div>
                ) : null}
                {detail.pendingReason ? (
                  <div>
                    <Label className="text-muted-foreground">Pending reason</Label>
                    <p>{detail.pendingReason}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
