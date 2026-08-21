import { useMemo, useState } from "react";
import { Ban, CheckCircle2, PauseCircle, PowerOff, Rocket } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  ticketFieldClass,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DatePickerField } from "@/components/date-picker-field";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CRM_GO_LIVE_CATEGORIES,
  crmGoLiveReady,
  isCrmGoLiveItemComplete,
} from "@/data/crm-onboarding-defaults";
import {
  crmAccountStatusLabel,
  isCrmAccountEnded,
} from "@/lib/crm-account-status";
import {
  crmAssigneeSelectPatch,
  crmAssigneeSelectValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmGoLiveChecklistItem } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  companyId: string;
  accountName: string;
  accountStatus: CrmAccount["status"];
  who?: string;
};

export function CrmGoLiveChecklist({ companyId, accountName, accountStatus, who }: Props) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const users = useUserStore((s) => s.users);
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const markLive = useCrmAccountStore((s) => s.markLive);
  const setAccountStatus = useCrmAccountStore((s) => s.setAccountStatus);
  const setGoLiveItem = useCrmOnboardingStore((s) => s.setGoLiveItem);
  const setGoLiveNotApplicable = useCrmOnboardingStore((s) => s.setGoLiveNotApplicable);
  const updateGoLiveMeta = useCrmOnboardingStore((s) => s.updateGoLiveMeta);
  const completeAllGoLiveItems = useCrmOnboardingStore((s) => s.completeAllGoLiveItems);
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);

  const items = record.goLiveChecklist;
  const isLive = accountStatus === "live";
  const isSuspended = accountStatus === "suspended";
  const isInactive = accountStatus === "inactive";
  const isEnded = isCrmAccountEnded(accountStatus);
  const ready = crmGoLiveReady(record);
  const done = items.filter((g) => isCrmGoLiveItemComplete(g)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [confirmSuspended, setConfirmSuspended] = useState(false);
  const [confirmInactive, setConfirmInactive] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [completeDate, setCompleteDate] = useState(todayYmd);

  const salesManager = useMemo(
    () => resolveCrmSalesManagerDefaults(account, users),
    [account, users],
  );

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

  const grouped = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? items
        : items.filter((i) => (i.category ?? "Readiness") === categoryFilter);
    const map = new Map<string, CrmGoLiveChecklistItem[]>();
    for (const item of filtered) {
      const cat = item.category ?? "Readiness";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return [...CRM_GO_LIVE_CATEGORIES]
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [items, categoryFilter]);

  function openCompleteDialog(item: CrmGoLiveChecklistItem) {
    setCompleteDialog({ key: item.key, label: item.label });
    setCompleteDate((item.completedAt ?? todayYmd()).slice(0, 10));
  }

  function handleDoneToggle(item: CrmGoLiveChecklistItem, checked: boolean) {
    if (!checked) {
      setGoLiveItem(companyId, item.key, "pending");
      return;
    }
    openCompleteDialog(item);
  }

  function confirmCompleteDate() {
    if (!completeDialog) return;
    const date = completeDate.trim().slice(0, 10);
    if (!date) {
      toast.error("Select a completed date");
      return;
    }
    setGoLiveItem(companyId, completeDialog.key, "completed", date);
    setCompleteDialog(null);
  }

  function setCompletedDate(item: CrmGoLiveChecklistItem, value: string) {
    const date = value.trim().slice(0, 10);
    if (!date) {
      setGoLiveItem(companyId, item.key, "pending");
      return;
    }
    setGoLiveItem(companyId, item.key, "completed", date);
  }

  function approveGoLive() {
    if (!crmGoLiveReady(useCrmOnboardingStore.getState().getByCompanyId(companyId)!)) {
      toast.error("Complete all go-live checklist items first");
      return;
    }
    markLive(companyId, who);
    updateTracker(companyId, { stage: "go_live" }, who);
    toast.success(`${accountName} marked Live`);
    setConfirmApprove(false);
  }

  function forceCompleteAccount() {
    completeAllGoLiveItems(companyId);
    markLive(companyId, who);
    updateTracker(companyId, { stage: "customer_success", priority: "medium" }, who);
    toast.success(`${accountName} completed & marked Live`);
    setConfirmForce(false);
  }

  function markSuspended() {
    setAccountStatus(companyId, "suspended", who);
    toast.success(`${accountName} marked Suspended`);
    setConfirmSuspended(false);
  }

  function markInactive() {
    setAccountStatus(companyId, "inactive", who);
    toast.success(`${accountName} marked Inactive`);
    setConfirmInactive(false);
  }

  const statusTone =
    isLive ? "success" : isSuspended ? "warning" : isInactive || accountStatus === "closed" ? "danger" : ready ? "warning" : "muted";
  const statusLabel = isLive
    ? "Live"
    : isSuspended
      ? "Suspended"
      : isInactive
        ? "Inactive"
        : ready
          ? "Ready"
          : crmAccountStatusLabel(accountStatus);

  return (
    <div className="space-y-2.5">
      <div className="card-soft flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">Go-Live & complete</div>
            <Pill tone={statusTone}>{statusLabel}</Pill>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {isLive
              ? "This account is already live."
              : isSuspended
                ? "This account is suspended — portal access and onboarding are paused."
                : isInactive
                  ? "This account is inactive — it is no longer in active onboarding."
                  : ready
                    ? "All checklist items are done — approve go-live, or force-complete the account."
                    : "Finish verification items, or use Go Live & Complete to finish the account directly."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={isLive || ready || isEnded}
            onClick={() => {
              completeAllGoLiveItems(companyId);
              toast.success("All go-live items marked complete");
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete checklist
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1 bg-primary text-xs"
            disabled={isLive || !ready || isEnded}
            onClick={() => setConfirmApprove(true)}
          >
            <Rocket className="h-3.5 w-3.5" />
            {isLive ? "Already Live" : "Approve Go-Live"}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1 bg-success text-xs text-white hover:bg-success/90"
            disabled={isLive || isEnded}
            onClick={() => setConfirmForce(true)}
          >
            <Rocket className="h-3.5 w-3.5" />
            Go Live & Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-warning/50 text-xs text-warning-foreground hover:bg-warning/10"
            disabled={isSuspended || isInactive || isLive}
            onClick={() => setConfirmSuspended(true)}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            {isSuspended ? "Suspended" : "Mark Suspended"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
            disabled={isInactive}
            onClick={() => setConfirmInactive(true)}
          >
            <PowerOff className="h-3.5 w-3.5" />
            {isInactive ? "Inactive" : "Mark Inactive"}
          </Button>
        </div>
      </div>

      <DesignTicketSection
        compact
        title="Go-live verification"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {done}/{items.length} done · {pct}%
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Confirm readiness, verification, sign-off, and handover before (or while) going live.
          Turning Done on asks for a completed date.
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
          {CRM_GO_LIVE_CATEGORIES.map((cat) => {
            const count = items.filter((i) => (i.category ?? "Readiness") === cat).length;
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

              <div className="space-y-1.5 md:hidden">
                {catItems.map((item) => {
                  const na = !!item.notApplicable;
                  const doneItem = isCrmGoLiveItemComplete(item);
                  return (
                    <div key={item.key} className={cn("card-soft space-y-2 p-2.5", na && "bg-muted/20")}>
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            na && "text-muted-foreground line-through",
                          )}
                        >
                          {item.label}
                        </div>
                        <Pill tone={na ? "muted" : doneItem ? "success" : "warning"}>
                          {na ? "N/A" : doneItem ? "Done" : "Pending"}
                        </Pill>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Completed</span>
                        <Switch
                          size="sm"
                          disabled={na}
                          checked={!na && item.status === "completed"}
                          onCheckedChange={(v) => handleDoneToggle(item, v)}
                        />
                      </div>
                      <DatePickerField
                        compact
                        disabled={na}
                        placeholder="Completed date"
                        value={item.completedAt ?? ""}
                        onChange={(v) => setCompletedDate(item, v)}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[10px]"
                          onClick={() => setGoLiveNotApplicable(companyId, item.key, !na)}
                        >
                          <Ban className="h-3 w-3" />
                          {na ? "Undo N/A" : "N/A"}
                        </Button>
                      </div>
                      <input
                        className={fieldClass}
                        placeholder={na ? "Why not applicable…" : "Remarks…"}
                        value={item.remarks ?? ""}
                        onChange={(e) =>
                          updateGoLiveMeta(companyId, item.key, { remarks: e.target.value })
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className={selectClass}
                          value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                          onChange={(e) =>
                            updateGoLiveMeta(companyId, item.key, {
                              assigneeUserId: crmAssigneeSelectPatch(
                                e.target.value,
                                salesManager.userId,
                              ),
                            })
                          }
                        >
                          <option value="">Assignee</option>
                          {assignees.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <DatePickerField
                          compact
                          placeholder="Due date"
                          value={item.dueDate ?? ""}
                          onChange={(v) =>
                            updateGoLiveMeta(companyId, item.key, {
                              dueDate: v || undefined,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[920px] text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Item</th>
                      <th className="px-2 py-1.5 text-center">Done</th>
                      <th className="px-2 py-1.5 text-center">N/A</th>
                      <th className="px-2 py-1.5 text-left">Completed</th>
                      <th className="px-2 py-1.5 text-left">Assignee</th>
                      <th className="px-2 py-1.5 text-left">Due</th>
                      <th className="px-2 py-1.5 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item) => {
                      const na = !!item.notApplicable;
                      return (
                        <tr key={item.key} className={cn("border-t", na && "bg-muted/20")}>
                          <td
                            className={cn(
                              "px-3 py-2 font-medium",
                              na && "text-muted-foreground line-through",
                            )}
                          >
                            {item.label}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Switch
                              size="sm"
                              disabled={na}
                              checked={!na && item.status === "completed"}
                              onCheckedChange={(v) => handleDoneToggle(item, v)}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setGoLiveNotApplicable(companyId, item.key, !na)}
                              className={cn(
                                "inline-flex h-7 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium",
                                na
                                  ? "border-muted-foreground/50 bg-muted text-muted-foreground"
                                  : "border-input hover:border-foreground/40 hover:bg-muted/50",
                              )}
                            >
                              <Ban className="h-3 w-3" />
                              N/A
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <DatePickerField
                              compact
                              className="w-40"
                              disabled={na}
                              placeholder="Completed date"
                              value={item.completedAt ?? ""}
                              onChange={(v) => setCompletedDate(item, v)}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="h-7 w-28 rounded border bg-background px-1.5 text-[11px]"
                              value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                              onChange={(e) =>
                                updateGoLiveMeta(companyId, item.key, {
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
                          </td>
                          <td className="px-2 py-2">
                            <DatePickerField
                              compact
                              className="w-40"
                              placeholder="Due date"
                              value={item.dueDate ?? ""}
                              onChange={(v) =>
                                updateGoLiveMeta(companyId, item.key, {
                                  dueDate: v || undefined,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className="h-7 w-full min-w-[8rem] rounded border bg-background px-1.5 text-[11px]"
                              value={item.remarks ?? ""}
                              placeholder={na ? "Why not applicable…" : "Remarks…"}
                              onChange={(e) =>
                                updateGoLiveMeta(companyId, item.key, { remarks: e.target.value })
                              }
                            />
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
        open={!!completeDialog}
        onOpenChange={(open) => {
          if (!open) setCompleteDialog(null);
        }}
        title={completeDialog ? `Complete “${completeDialog.label}”` : "Complete item"}
        submitLabel="Mark complete"
        onSubmit={confirmCompleteDate}
      >
        {completeDialog ? (
          <label className="block text-xs font-medium">
            Completed date
            <DatePickerField
              modal
              className="mt-1"
              value={completeDate}
              onChange={setCompleteDate}
            />
          </label>
        ) : null}
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Approve go-live?"
        description={`${accountName} will be marked Live. Checklist is complete.`}
        confirmLabel="Mark Live"
        confirmTone="default"
        onConfirm={approveGoLive}
      />

      <ConfirmDeleteDialog
        open={confirmForce}
        onOpenChange={setConfirmForce}
        title="Go Live & Complete account?"
        description={`This will complete remaining go-live checklist items and mark ${accountName} as Live immediately. Use when you want to finish the account without waiting on each item.`}
        confirmLabel="Go Live & Complete"
        confirmTone="default"
        onConfirm={forceCompleteAccount}
      />

      <ConfirmDeleteDialog
        open={confirmSuspended}
        onOpenChange={setConfirmSuspended}
        title="Mark account suspended?"
        description={`${accountName} will be marked Suspended. Use when the client is temporarily paused but may resume onboarding later.`}
        confirmLabel="Mark Suspended"
        confirmTone="default"
        onConfirm={markSuspended}
      />

      <ConfirmDeleteDialog
        open={confirmInactive}
        onOpenChange={setConfirmInactive}
        title="Mark account inactive?"
        description={`${accountName} will be marked Inactive. Use when the account should no longer be treated as active onboarding.`}
        confirmLabel="Mark Inactive"
        confirmTone="destructive"
        onConfirm={markInactive}
      />
    </div>
  );
}
