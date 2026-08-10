import { useMemo, useState } from "react";
import { Minus, Plus, History } from "lucide-react";
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
import { CRM_REPORT_CATEGORIES } from "@/data/crm-onboarding-defaults";
import { cn, formatDate } from "@/lib/utils";
import { useCrmOnboardingStore } from "@/stores";
import { nowIso } from "@/types/common";
import type { CrmReportChecklistItem } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[64px] text-xs");

export function CrmReportsChecklist({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setReportItem = useCrmOnboardingStore((s) => s.setReportItem);
  const logReportExplanation = useCrmOnboardingStore((s) => s.logReportExplanation);
  const adjustReportExplanationCount = useCrmOnboardingStore((s) => s.adjustReportExplanationCount);

  const items = record.reportChecklist;
  const done = items.filter((r) => r.status === "explained").length;
  const totalSessions = items.reduce((s, r) => s + (r.explanationCount ?? 0), 0);
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [logging, setLogging] = useState<CrmReportChecklistItem | null>(null);
  const [historyFor, setHistoryFor] = useState<CrmReportChecklistItem | null>(null);
  const [sessionDate, setSessionDate] = useState(nowIso().slice(0, 10));
  const [sessionTrainer, setSessionTrainer] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const grouped = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? items
        : items.filter((i) => (i.category ?? "Sales reports") === categoryFilter);
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
  }, [items, categoryFilter]);

  function openLog(item: CrmReportChecklistItem) {
    setLogging(item);
    setSessionDate(nowIso().slice(0, 10));
    setSessionTrainer(item.trainerName ?? "");
    setSessionNote("");
  }

  function confirmLog() {
    if (!logging) return;
    logReportExplanation(companyId, logging.key, {
      explainedAt: sessionDate,
      trainerName: sessionTrainer,
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
            {done}/{items.length} covered · {totalSessions} sessions · {pct}%
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Explain each report to the client. Use the counter when the same report is covered more than
          once across sessions.
        </p>
        <ProgressBar value={pct} className="mb-3 h-1.5" />

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
          {grouped.map(({ category, items: catItems }) => (
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>

              {/* Mobile cards */}
              <div className="space-y-1.5 md:hidden">
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
                    onTrainer={(v) => setReportItem(companyId, r.key, { trainerName: v })}
                    onNotes={(v) => setReportItem(companyId, r.key, { notes: v })}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Report</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                      <th className="px-2 py-1.5 text-center">Sessions</th>
                      <th className="px-2 py-1.5 text-left">Last explained</th>
                      <th className="px-2 py-1.5 text-left">Trainer</th>
                      <th className="px-2 py-1.5 text-left">Notes</th>
                      <th className="px-2 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((r) => (
                      <tr key={r.key} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="px-2 py-2 text-center">
                          <Pill tone={r.status === "explained" ? "success" : "muted"}>
                            {r.status === "explained" ? "Explained" : "Pending"}
                          </Pill>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              disabled={(r.explanationCount ?? 0) <= 0}
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
                              className="h-7 w-7 p-0"
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
                        <td className="px-2 py-2 text-muted-foreground">
                          {r.explainedAt ? formatDate(r.explainedAt) : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="h-7 w-28 rounded border bg-background px-1.5 text-[11px]"
                            value={r.trainerName ?? ""}
                            placeholder="Trainer"
                            onChange={(e) =>
                              setReportItem(companyId, r.key, { trainerName: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="h-7 w-full min-w-[8rem] rounded border bg-background px-1.5 text-[11px]"
                            value={r.notes ?? ""}
                            placeholder="Session notes…"
                            onChange={(e) =>
                              setReportItem(companyId, r.key, { notes: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 gap-1 bg-primary text-[10px]"
                              onClick={() => openLog(r)}
                            >
                              <Plus className="h-3 w-3" />
                              Log
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[10px]"
                              disabled={!r.explanationLog?.length}
                              onClick={() => setHistoryFor(r)}
                            >
                              <History className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
              <input
                className={cn(fieldClass, "mt-1")}
                value={sessionTrainer}
                onChange={(e) => setSessionTrainer(e.target.value)}
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
  onNotes,
}: {
  item: CrmReportChecklistItem;
  onLog: () => void;
  onHistory: () => void;
  onInc: () => void;
  onDec: () => void;
  onTrainer: (v: string) => void;
  onNotes: (v: string) => void;
}) {
  return (
    <div className="card-soft space-y-2 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs font-medium">{item.label}</div>
        <Pill tone={item.status === "explained" ? "success" : "muted"}>
          {item.status === "explained" ? "Explained" : "Pending"}
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
            disabled={(item.explanationCount ?? 0) <= 0}
            onClick={onDec}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
            {item.explanationCount ?? 0}
          </span>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onInc}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <input
        className={selectClass}
        value={item.trainerName ?? ""}
        placeholder="Trainer"
        onChange={(e) => onTrainer(e.target.value)}
      />
      <input
        className={fieldClass}
        value={item.notes ?? ""}
        placeholder="Notes…"
        onChange={(e) => onNotes(e.target.value)}
      />
      <div className="flex gap-1.5">
        <Button type="button" size="sm" className="h-7 flex-1 gap-1 bg-primary text-[10px]" onClick={onLog}>
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
      </div>
    </div>
  );
}
