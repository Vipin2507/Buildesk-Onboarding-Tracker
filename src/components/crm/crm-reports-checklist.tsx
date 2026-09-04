import { Fragment, useMemo, useState } from "react";
import { Ban, History, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CrmTrainerSelect } from "@/components/crm/crm-trainer-select";
import { CrmChecklistStatusFilterBar } from "@/components/crm/crm-checklist-status-filter-bar";
import { CRM_REPORT_CATEGORIES } from "@/data/crm-onboarding-defaults";
import {
  crmTrainerInputPatch,
  crmTrainerInputValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import {
  countReportStatusFilters,
  matchesReportStatusFilter,
  type CrmChecklistStatusFilter,
} from "@/lib/crm-checklist-filters";
import { useSessionFilter } from "@/hooks/use-session-filter";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";
import { nowIso } from "@/types/common";
import type { CrmReportChecklistItem } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[64px] text-xs");

export function CrmReportsChecklist({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const users = useUserStore((s) => s.users);
  const setReportItem = useCrmOnboardingStore((s) => s.setReportItem);
  const logReportExplanation = useCrmOnboardingStore((s) => s.logReportExplanation);
  const adjustReportExplanationCount = useCrmOnboardingStore((s) => s.adjustReportExplanationCount);

  const items = record.reportChecklist;
  const applicable = items.filter((r) => !r.notApplicable);
  const done = applicable.filter((r) => r.status === "explained").length;
  const totalSessions = items.reduce((s, r) => s + (r.explanationCount ?? 0), 0);
  const pct = applicable.length ? Math.round((done / applicable.length) * 100) : 0;

  const salesManager = useMemo(
    () => resolveCrmSalesManagerDefaults(account, users),
    [account, users],
  );
  const trainerNames = useMemo(
    () =>
      withCrmSalesManagerOption(
        users.filter(
          (user) =>
            user.active &&
            (user.productScope === "crm" || !user.productScope || user.role === "Admin"),
        ),
        salesManager,
        users,
      ).map((user) => user.name),
    [salesManager, users],
  );

  const [categoryFilter, setCategoryFilter] = useSessionFilter(
    `crm.account.${companyId}.reports.category`,
    "all",
  );
  const [statusFilter, setStatusFilter] = useSessionFilter<CrmChecklistStatusFilter>(
    `crm.account.${companyId}.reports.status`,
    "all",
  );
  const statusCounts = useMemo(() => countReportStatusFilters(items), [items]);
  const [logging, setLogging] = useState<CrmReportChecklistItem | null>(null);
  const [historyFor, setHistoryFor] = useState<CrmReportChecklistItem | null>(null);
  const [sessionDate, setSessionDate] = useState(nowIso().slice(0, 10));
  const [sessionTrainer, setSessionTrainer] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const grouped = useMemo(() => {
    let filtered = items;
    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => matchesReportStatusFilter(i, statusFilter));
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((i) => (i.category ?? "Sales reports") === categoryFilter);
    }
    const map = new Map<string, CrmReportChecklistItem[]>();
    for (const item of filtered) {
      const cat = item.category ?? "Sales reports";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    const order = [...CRM_REPORT_CATEGORIES];
    return order
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [items, categoryFilter, statusFilter]);

  function openLog(item: CrmReportChecklistItem) {
    if (item.notApplicable) return;
    setLogging(item);
    setSessionDate(nowIso().slice(0, 10));
    setSessionTrainer(crmTrainerInputValue(item.trainerName, salesManager.name));
    setSessionNote("");
  }

  function toggleNa(item: CrmReportChecklistItem) {
    const next = !item.notApplicable;
    setReportItem(companyId, item.key, { notApplicable: next });
    toast.success(next ? `Marked N/A · ${item.label}` : `Restored · ${item.label}`);
  }

  function confirmLog() {
    if (!logging || logging.notApplicable) return;
    logReportExplanation(companyId, logging.key, {
      explainedAt: sessionDate,
      trainerName:
        crmTrainerInputPatch(sessionTrainer, salesManager.name) ||
        salesManager.name ||
        sessionTrainer,
      note: sessionNote,
    });
    toast.success(`Logged explanation #${(logging.explanationCount ?? 0) + 1} · ${logging.label}`);
    setLogging(null);
  }

  return (
    <div className="space-y-2.5">
      <DesignTicketSection
        compact
        title="Report explanation"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {done}/{applicable.length} covered · {totalSessions} sessions · {pct}%
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Explain each report to the client. Use the counter when the same report is covered more than
          once across sessions. Mark N/A for reports that do not apply.
        </p>
        <ProgressBar value={pct} className="mb-3 h-1.5" />

        <CrmChecklistStatusFilterBar
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
          completedLabel="Completed"
        />

        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
              categoryFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            All ({items.length})
          </button>
          {CRM_REPORT_CATEGORIES.map((cat) => {
            const count = items.filter((i) => (i.category ?? "Sales reports") === cat).length;
            if (!count) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  categoryFilter === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No items match this filter.
            </div>
          ) : null}

          {grouped.map(({ category, items: catItems }) => (
            <div key={category} className="space-y-1.5 md:hidden">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>
              <div className="space-y-1.5">
                {catItems.map((r) => (
                  <ReportCard
                    key={r.key}
                    item={r}
                    onLog={() => openLog(r)}
                    onHistory={() => setHistoryFor(r)}
                    onInc={() => {
                      adjustReportExplanationCount(companyId, r.key, 1);
                      toast.success(`+1 · ${r.label}`);
                    }}
                    onDec={() => {
                      if ((r.explanationCount ?? 0) <= 0) return;
                      adjustReportExplanationCount(companyId, r.key, -1);
                    }}
                    onTrainer={(v) =>
                      setReportItem(companyId, r.key, {
                        trainerName: crmTrainerInputPatch(v, salesManager.name),
                      })
                    }
                    trainerDisplay={crmTrainerInputValue(r.trainerName, salesManager.name)}
                    trainerNames={trainerNames}
                    onNotes={(v) => setReportItem(companyId, r.key, { notes: v })}
                    onNa={() => toggleNa(r)}
                  />
                ))}
              </div>
            </div>
          ))}

          {grouped.length > 0 ? (
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full min-w-[960px] table-fixed text-xs">
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Report</th>
                    <th className="px-2 py-1.5 text-center">Status</th>
                    <th className="px-2 py-1.5 text-center">Sessions</th>
                    <th className="px-2 py-1.5 text-center">Last explained</th>
                    <th className="px-2 py-1.5 text-left">Trainer</th>
                    <th className="px-2 py-1.5 text-left">Notes</th>
                    <th className="px-2 py-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ category, items: catItems }) => (
                    <Fragment key={category}>
                      <tr className="border-t bg-muted/30">
                        <td
                          colSpan={7}
                          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {category}
                        </td>
                      </tr>
                      {catItems.map((r) => {
                        const na = !!r.notApplicable;
                        const covered = !na && r.status === "explained";
                        return (
                          <tr
                            key={r.key}
                            className={cn("border-t align-middle hover:bg-muted/20", na && "bg-muted/20")}
                          >
                            <td
                              className={cn(
                                "px-3 py-2 align-middle font-medium",
                                na && "text-muted-foreground line-through",
                              )}
                            >
                              {r.label}
                            </td>
                            <td className="px-2 py-2 text-center align-middle">
                              <Pill tone={na ? "muted" : covered ? "success" : "warning"}>
                                {na ? "N/A" : covered ? "Explained" : "Pending"}
                              </Pill>
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 shrink-0 p-0"
                                  disabled={na || (r.explanationCount ?? 0) <= 0}
                                  onClick={() => adjustReportExplanationCount(companyId, r.key, -1)}
                                  aria-label={`Decrease ${r.label} count`}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                                  {r.explanationCount ?? 0}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 shrink-0 p-0"
                                  disabled={na}
                                  onClick={() => {
                                    adjustReportExplanationCount(companyId, r.key, 1);
                                    toast.success(`+1 · ${r.label}`);
                                  }}
                                  aria-label={`Increase ${r.label} count`}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center align-middle whitespace-nowrap text-muted-foreground">
                              {r.explainedAt ? formatDate(r.explainedAt) : "—"}
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <CrmTrainerSelect
                                disabled={na}
                                className="h-7 w-full min-w-0"
                                value={crmTrainerInputValue(r.trainerName, salesManager.name)}
                                executiveNames={trainerNames}
                                onChange={(value) =>
                                  setReportItem(companyId, r.key, {
                                    trainerName: crmTrainerInputPatch(value, salesManager.name),
                                  })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <input
                                disabled={na}
                                className="h-7 w-full min-w-0 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                                value={r.notes ?? ""}
                                placeholder="Session notes…"
                                onChange={(e) =>
                                  setReportItem(companyId, r.key, { notes: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 text-right align-middle">
                              <div className="flex flex-nowrap items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 shrink-0 gap-1 bg-primary px-2 text-[10px]"
                                  disabled={na}
                                  onClick={() => openLog(r)}
                                >
                                  <Plus className="h-3 w-3" />
                                  Log
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 shrink-0 p-0"
                                  disabled={!r.explanationLog?.length}
                                  onClick={() => setHistoryFor(r)}
                                  aria-label="Explanation history"
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                                  onClick={() => toggleNa(r)}
                                >
                                  <Ban className="h-3 w-3" />
                                  {na ? "Undo" : "N/A"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </DesignTicketSection>

      <EntityFormModal
        open={!!logging}
        onOpenChange={(open) => {
          if (!open) setLogging(null);
        }}
        title={logging ? `Log explanation · ${logging.label}` : "Log explanation"}
        submitLabel="Add session"
        onSubmit={confirmLog}
      >
        {logging ? (
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
              Current sessions:{" "}
              <span className="font-semibold text-foreground">{logging.explanationCount ?? 0}</span>
              . This will add one more explanation session.
            </p>
            <label className="text-[10px] text-muted-foreground">
              Date explained
              <DatePickerField
                modal
                className="mt-1"
                value={sessionDate}
                onChange={(v) => setSessionDate(v)}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Trainer / facilitator
              <CrmTrainerSelect
                className={cn(fieldClass, "mt-1")}
                value={sessionTrainer}
                executiveNames={trainerNames}
                onChange={setSessionTrainer}
                placeholder="Who explained this report?"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Session notes
              <textarea
                className={cn(areaClass, "mt-1")}
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                placeholder="Topics covered, questions, follow-ups…"
              />
            </label>
          </div>
        ) : null}
      </EntityFormModal>

      <EntityFormModal
        open={!!historyFor}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
        title={historyFor ? `Sessions · ${historyFor.label}` : "Sessions"}
        submitLabel="Close"
        onSubmit={() => setHistoryFor(null)}
      >
        {historyFor ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {historyFor.explanationCount ?? 0} explanation session
              {(historyFor.explanationCount ?? 0) === 1 ? "" : "s"} logged
            </p>
            {(historyFor.explanationLog ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No session history yet.</p>
            ) : (
              (historyFor.explanationLog ?? []).map((entry, idx) => (
                <div key={entry.id} className="card-soft p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      Session {(historyFor.explanationLog?.length ?? 0) - idx}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(entry.explainedAt)}
                    </span>
                  </div>
                  {entry.trainerName ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Trainer: {entry.trainerName}
                    </div>
                  ) : null}
                  {entry.note ? <div className="mt-1 text-muted-foreground">{entry.note}</div> : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </EntityFormModal>
    </div>
  );
}

function ReportCard({
  item,
  onLog,
  onHistory,
  onInc,
  onDec,
  onTrainer,
  trainerDisplay,
  trainerNames,
  onNotes,
  onNa,
}: {
  item: CrmReportChecklistItem;
  onLog: () => void;
  onHistory: () => void;
  onInc: () => void;
  onDec: () => void;
  onTrainer: (v: string) => void;
  trainerDisplay: string;
  trainerNames: string[];
  onNotes: (v: string) => void;
  onNa: () => void;
}) {
  const na = !!item.notApplicable;
  const covered = !na && item.status === "explained";

  return (
    <div className={cn("card-soft space-y-2 p-2.5", na && "bg-muted/20")}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("min-w-0 text-xs font-medium", na && "line-through text-muted-foreground")}>
          {item.label}
        </div>
        <Pill tone={na ? "muted" : covered ? "success" : "warning"}>
          {na ? "N/A" : covered ? "Explained" : "Pending"}
        </Pill>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">Explanation sessions</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={na || (item.explanationCount ?? 0) <= 0}
            onClick={onDec}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
            {item.explanationCount ?? 0}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={na}
            onClick={onInc}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <CrmTrainerSelect
        disabled={na}
        className={selectClass}
        value={trainerDisplay}
        executiveNames={trainerNames}
        placeholder="Trainer"
        onChange={onTrainer}
      />
      <input
        disabled={na}
        className={cn(fieldClass, "disabled:opacity-50")}
        value={item.notes ?? ""}
        placeholder="Notes…"
        onChange={(e) => onNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 gap-1 bg-primary text-[10px]"
          disabled={na}
          onClick={onLog}
        >
          <Plus className="h-3 w-3" />
          Log session
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[10px]"
          disabled={!item.explanationLog?.length}
          onClick={onHistory}
        >
          <History className="h-3 w-3" />
          History
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={onNa}>
          <Ban className="h-3 w-3" />
          {na ? "Undo" : "N/A"}
        </Button>
      </div>
    </div>
  );
}
