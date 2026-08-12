import { useMemo, useState } from "react";
import { Ban, History, Minus, Plus, Trash2 } from "lucide-react";
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
import {
  CRM_TRAINING_CATEGORIES_BROKER,
  CRM_TRAINING_CATEGORIES_DEVELOPER,
} from "@/data/crm-onboarding-defaults";
import { resolveCrmTrainingCategories } from "@/lib/crm-training-catalog";
import {
  crmAssigneeSelectPatch,
  crmAssigneeSelectValue,
  crmTrainerInputPatch,
  crmTrainerInputValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";
import { newId, nowIso } from "@/types/common";
import type { CrmTrainingSession } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[64px] text-xs");

export function CrmTrainingChecklist({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const users = useUserStore((s) => s.users);
  const upsert = useCrmOnboardingStore((s) => s.upsertTrainingSession);
  const logTrainingSession = useCrmOnboardingStore((s) => s.logTrainingSession);
  const adjustTrainingSessionCount = useCrmOnboardingStore((s) => s.adjustTrainingSessionCount);
  const setTrainingNotApplicable = useCrmOnboardingStore((s) => s.setTrainingNotApplicable);
  const removeTrainingSession = useCrmOnboardingStore((s) => s.removeTrainingSession);

  const salesManager = useMemo(
    () => resolveCrmSalesManagerDefaults(account, users),
    [account, users],
  );

  const sessions = record.trainingSessions;
  const track = sessions[0]?.track ?? "developer";
  const categories = useMemo(() => {
    const preferred = resolveCrmTrainingCategories(track);
    const fromItems = [...new Set(sessions.map((s) => s.category ?? "Custom"))];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const cat of preferred) {
      if ((cat === "Custom" || fromItems.includes(cat)) && !seen.has(cat)) {
        out.push(cat);
        seen.add(cat);
      }
    }
    for (const cat of fromItems) {
      if (!seen.has(cat)) {
        out.push(cat);
        seen.add(cat);
      }
    }
    return out.length
      ? out
      : [
          ...(track === "broker_cp"
            ? CRM_TRAINING_CATEGORIES_BROKER
            : CRM_TRAINING_CATEGORIES_DEVELOPER),
        ];
  }, [sessions, track]);

  const applicable = sessions.filter((s) => !s.notApplicable);
  const done = applicable.filter((s) => s.completed || (s.sessionCount ?? 0) > 0).length;
  const totalSessions = sessions.reduce((sum, s) => sum + (s.sessionCount ?? 0), 0);
  const pct = applicable.length ? Math.round((done / applicable.length) * 100) : 0;

  const assignees = useMemo(
    () =>
      withCrmSalesManagerOption(
        users.filter(
          (u) => u.active && (u.productScope === "crm" || !u.productScope || u.role === "Admin"),
        ),
        salesManager,
        users,
      ),
    [users, salesManager],
  );

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<CrmTrainingSession | null>(null);
  const [logging, setLogging] = useState<CrmTrainingSession | null>(null);
  const [historyFor, setHistoryFor] = useState<CrmTrainingSession | null>(null);
  const [sessionDate, setSessionDate] = useState(nowIso().slice(0, 10));
  const [sessionTrainer, setSessionTrainer] = useState("");
  const [sessionHours, setSessionHours] = useState("1");
  const [sessionAttendance, setSessionAttendance] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionRecording, setSessionRecording] = useState(false);

  const grouped = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? sessions
        : sessions.filter((s) => (s.category ?? "Custom") === categoryFilter);
    const map = new Map<string, CrmTrainingSession[]>();
    for (const item of filtered) {
      const cat = item.category ?? "Custom";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    const order = categories;
    const known = order.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
    const extras = [...map.keys()]
      .filter((c) => !order.includes(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
    return [...known, ...extras];
  }, [sessions, categoryFilter, categories]);

  function blankSession(): CrmTrainingSession {
    const now = nowIso();
    return {
      id: newId(),
      templateKey: `custom-${Date.now()}`,
      label: "Custom training session",
      track,
      category: "Custom",
      trainerName: "",
      trainingDate: "",
      durationHours: 1,
      attendance: "",
      recordingUploaded: false,
      completed: false,
      sessionCount: 0,
      sessionLog: [],
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  function openLog(item: CrmTrainingSession) {
    setLogging(item);
    setSessionDate(item.trainingDate || nowIso().slice(0, 10));
    setSessionTrainer(crmTrainerInputValue(item.trainerName, salesManager.name));
    setSessionHours(String(item.durationHours || 1));
    setSessionAttendance(item.attendance || "");
    setSessionNote("");
    setSessionRecording(item.recordingUploaded);
  }

  function confirmLog() {
    if (!logging) return;
    logTrainingSession(companyId, logging.id, {
      trainingDate: sessionDate,
      trainerName: crmTrainerInputPatch(sessionTrainer, salesManager.name) || salesManager.name || sessionTrainer,
      durationHours: Number(sessionHours) || 0,
      attendance: sessionAttendance,
      note: sessionNote,
      recordingUploaded: sessionRecording,
    });
    toast.success(`Logged session #${(logging.sessionCount ?? 0) + 1} · ${logging.label}`);
    setLogging(null);
  }

  return (
    <div className="space-y-2.5">
      <DesignTicketSection
        compact
        title={`Training · ${track === "broker_cp" ? "Broker / CP" : "Developer"}`}
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {done}/{applicable.length} covered · {totalSessions} sessions · {pct}%
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[10px]"
              onClick={() => setEditing(blankSession())}
            >
              <Plus className="h-3 w-3" />
              Add session
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Conduct each role/module training. Use the session counter when the same training is run
          more than once.
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
            All ({sessions.length})
          </button>
          {categories.map((cat) => {
            const count = sessions.filter((s) => (s.category ?? "Custom") === cat).length;
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
          {grouped.map(({ category, items }) => (
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>

              <div className="space-y-1.5 md:hidden">
                {items.map((s) => (
                  <TrainingCard
                    key={s.id}
                    item={s}
                    onEdit={() => setEditing({ ...s })}
                    onLog={() => openLog(s)}
                    onHistory={() => setHistoryFor(s)}
                    onInc={() => {
                      adjustTrainingSessionCount(companyId, s.id, 1);
                      toast.success(`+1 · ${s.label}`);
                    }}
                    onDec={() => {
                      if ((s.sessionCount ?? 0) <= 0) return;
                      adjustTrainingSessionCount(companyId, s.id, -1);
                    }}
                    onNa={() => setTrainingNotApplicable(companyId, s.id, !s.notApplicable)}
                    onDelete={
                      s.templateKey.startsWith("custom-")
                        ? () => {
                            removeTrainingSession(companyId, s.id);
                            toast.success("Custom session removed");
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[920px] text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Training</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                      <th className="px-2 py-1.5 text-center">Sessions</th>
                      <th className="px-2 py-1.5 text-left">Last date</th>
                      <th className="px-2 py-1.5 text-left">Trainer</th>
                      <th className="px-2 py-1.5 text-left">Attendance</th>
                      <th className="px-2 py-1.5 text-left">Assignee / due</th>
                      <th className="px-2 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const na = !!s.notApplicable;
                      const covered = !na && (s.completed || (s.sessionCount ?? 0) > 0);
                      return (
                        <tr key={s.id} className={cn("border-t", na && "bg-muted/20")}>
                          <td
                            className={cn(
                              "px-3 py-2 font-medium",
                              na && "text-muted-foreground line-through",
                            )}
                          >
                            {s.label}
                            {s.recordingUploaded ? (
                              <Pill className="ml-2" tone="info">
                                Recording
                              </Pill>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Pill tone={na ? "muted" : covered ? "success" : "warning"}>
                              {na ? "N/A" : covered ? "Done" : "Pending"}
                            </Pill>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={na || (s.sessionCount ?? 0) <= 0}
                                onClick={() => adjustTrainingSessionCount(companyId, s.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                                {s.sessionCount ?? 0}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={na}
                                onClick={() => {
                                  adjustTrainingSessionCount(companyId, s.id, 1);
                                  toast.success(`+1 · ${s.label}`);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {s.trainingDate ? formatDate(s.trainingDate) : "—"}
                            {s.durationHours ? (
                              <span className="ml-1 text-[10px]">· {s.durationHours}h</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              disabled={na}
                              className="h-7 w-28 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                              value={crmTrainerInputValue(s.trainerName, salesManager.name)}
                              placeholder="Trainer"
                              onChange={(e) =>
                                upsert(companyId, {
                                  ...s,
                                  trainerName: crmTrainerInputPatch(
                                    e.target.value,
                                    salesManager.name,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              disabled={na}
                              className="h-7 w-24 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                              value={s.attendance}
                              placeholder="e.g. 8/10"
                              onChange={(e) =>
                                upsert(companyId, { ...s, attendance: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <select
                                disabled={na}
                                className="h-7 w-28 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                                value={crmAssigneeSelectValue(s.assigneeUserId, salesManager.userId)}
                                onChange={(e) =>
                                  upsert(companyId, {
                                    ...s,
                                    assigneeUserId: crmAssigneeSelectPatch(
                                      e.target.value,
                                      salesManager.userId,
                                    ),
                                  })
                                }
                              >
                                <option value="">Unassigned</option>
                                {assignees.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                              <DatePickerField
                                compact
                                disabled={na}
                                className="w-40"
                                placeholder="Due date"
                                value={s.dueDate ?? ""}
                                onChange={(v) =>
                                  upsert(companyId, {
                                    ...s,
                                    dueDate: v || undefined,
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-[10px]"
                                onClick={() => setTrainingNotApplicable(companyId, s.id, !na)}
                              >
                                <Ban className="h-3 w-3" />
                                {na ? "Undo N/A" : "N/A"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 gap-1 bg-primary text-[10px]"
                                disabled={na}
                                onClick={() => openLog(s)}
                              >
                                <Plus className="h-3 w-3" />
                                Log
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                onClick={() => setEditing({ ...s })}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-[10px]"
                                disabled={!s.sessionLog?.length}
                                onClick={() => setHistoryFor(s)}
                              >
                                <History className="h-3 w-3" />
                              </Button>
                              {s.templateKey.startsWith("custom-") ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-[10px] text-destructive"
                                  onClick={() => {
                                    removeTrainingSession(companyId, s.id);
                                    toast.success("Custom session removed");
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DesignTicketSection>

      <EntityFormModal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing?.templateKey.startsWith("custom-") ? "Training session" : editing?.label || "Training"}
        submitLabel="Save"
        onSubmit={() => {
          if (!editing) return;
          if (!editing.label.trim()) {
            toast.error("Session name is required");
            return;
          }
          upsert(companyId, {
            ...editing,
            label: editing.label.trim(),
            completed: editing.completed || (editing.sessionCount ?? 0) > 0,
          });
          setEditing(null);
          toast.success("Training saved");
        }}
        contentClassName="max-w-lg"
      >
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] text-muted-foreground sm:col-span-2">
              Session name
              <input
                className={cn(fieldClass, "mt-1")}
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Trainer
              <input
                className={cn(fieldClass, "mt-1")}
                value={crmTrainerInputValue(editing.trainerName, salesManager.name)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    trainerName: crmTrainerInputPatch(e.target.value, salesManager.name),
                  })
                }
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Date
              <DatePickerField
                modal
                className="mt-1"
                value={editing.trainingDate}
                onChange={(v) => setEditing({ ...editing, trainingDate: v })}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Duration (hours)
              <input
                type="number"
                min={0}
                step={0.5}
                className={cn(fieldClass, "mt-1")}
                value={editing.durationHours || ""}
                onChange={(e) =>
                  setEditing({ ...editing, durationHours: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Attendance
              <input
                className={cn(fieldClass, "mt-1")}
                value={editing.attendance}
                onChange={(e) => setEditing({ ...editing, attendance: e.target.value })}
                placeholder="e.g. 8 / 10"
              />
            </label>
            <label className="text-[10px] text-muted-foreground sm:col-span-2">
              Notes
              <textarea
                className={cn(areaClass, "mt-1")}
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Agenda, feedback, follow-ups…"
              />
            </label>
            <div className="flex flex-wrap gap-4 text-xs sm:col-span-2">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.recordingUploaded}
                  onChange={(e) =>
                    setEditing({ ...editing, recordingUploaded: e.target.checked })
                  }
                />
                Recording uploaded
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.completed || (editing.sessionCount ?? 0) > 0}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      completed: e.target.checked,
                      sessionCount: e.target.checked
                        ? Math.max(1, editing.sessionCount ?? 0)
                        : editing.sessionCount,
                    })
                  }
                />
                Mark covered
              </label>
            </div>
          </div>
        ) : null}
      </EntityFormModal>

      <EntityFormModal
        open={!!logging}
        onOpenChange={(open) => {
          if (!open) setLogging(null);
        }}
        title={logging ? `Log session · ${logging.label}` : "Log session"}
        submitLabel="Add session"
        onSubmit={confirmLog}
      >
        {logging ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Current sessions:{" "}
              <span className="font-semibold text-foreground">{logging.sessionCount ?? 0}</span>
            </p>
            <label className="text-[10px] text-muted-foreground">
              Date
              <DatePickerField
                modal
                className="mt-1"
                value={sessionDate}
                onChange={(v) => setSessionDate(v)}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Duration (hours)
              <input
                type="number"
                min={0}
                step={0.5}
                className={cn(fieldClass, "mt-1")}
                value={sessionHours}
                onChange={(e) => setSessionHours(e.target.value)}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Trainer
              <input
                className={cn(fieldClass, "mt-1")}
                value={sessionTrainer}
                onChange={(e) => setSessionTrainer(e.target.value)}
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Attendance
              <input
                className={cn(fieldClass, "mt-1")}
                value={sessionAttendance}
                onChange={(e) => setSessionAttendance(e.target.value)}
                placeholder="e.g. 8 / 10"
              />
            </label>
            <label className="text-[10px] text-muted-foreground sm:col-span-2">
              Session notes
              <textarea
                className={cn(areaClass, "mt-1")}
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={sessionRecording}
                onChange={(e) => setSessionRecording(e.target.checked)}
              />
              Recording uploaded for this session
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
              {historyFor.sessionCount ?? 0} session
              {(historyFor.sessionCount ?? 0) === 1 ? "" : "s"} logged
            </p>
            {(historyFor.sessionLog ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No session history yet.</p>
            ) : (
              (historyFor.sessionLog ?? []).map((entry, idx) => (
                <div key={entry.id} className="card-soft p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      Session {(historyFor.sessionLog?.length ?? 0) - idx}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(entry.trainingDate)}
                      {entry.durationHours ? ` · ${entry.durationHours}h` : ""}
                    </span>
                  </div>
                  {entry.trainerName ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Trainer: {entry.trainerName}
                    </div>
                  ) : null}
                  {entry.attendance ? (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Attendance: {entry.attendance}
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

function TrainingCard({
  item,
  onEdit,
  onLog,
  onHistory,
  onInc,
  onDec,
  onNa,
  onDelete,
}: {
  item: CrmTrainingSession;
  onEdit: () => void;
  onLog: () => void;
  onHistory: () => void;
  onInc: () => void;
  onDec: () => void;
  onNa: () => void;
  onDelete?: () => void;
}) {
  const na = !!item.notApplicable;
  const covered = !na && (item.completed || (item.sessionCount ?? 0) > 0);

  return (
    <div className={cn("card-soft space-y-2 p-2.5", na && "bg-muted/20")}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("min-w-0 text-xs font-medium", na && "line-through text-muted-foreground")}>
          {item.label}
        </div>
        <Pill tone={na ? "muted" : covered ? "success" : "warning"}>
          {na ? "N/A" : covered ? "Done" : "Pending"}
        </Pill>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">Sessions conducted</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={na || (item.sessionCount ?? 0) <= 0}
            onClick={onDec}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
            {item.sessionCount ?? 0}
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
      <div className="text-[10px] text-muted-foreground">
        {item.trainerName || "No trainer"} ·{" "}
        {item.trainingDate ? formatDate(item.trainingDate) : "No date"} · {item.durationHours || 0}h
      </div>
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
        <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[10px]"
          disabled={!item.sessionLog?.length}
          onClick={onHistory}
        >
          <History className="h-3 w-3" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={onNa}>
          <Ban className="h-3 w-3" />
          {na ? "Undo" : "N/A"}
        </Button>
        {onDelete ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[10px] text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
