import { useMemo, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  ticketFieldClass,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { CrmChecklistPhaseCell } from "@/components/crm/crm-checklist-phase-cell";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import {
  calcChecklistProgress,
  canToggleChecklistPhase,
  countApplicableChecklist,
  phaseAtToYmd,
  type ChecklistPhase,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import {
  crmAssigneeSelectPatch,
  crmAssigneeSelectValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";
import type { CrmMasterChecklistItem } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");

export function CrmMasterChecklistDetail({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const users = useUserStore((s) => s.users);
  const toggleMasterPhase = useCrmOnboardingStore((s) => s.toggleMasterPhase);
  const setMasterPhaseDate = useCrmOnboardingStore((s) => s.setMasterPhaseDate);
  const forceCompleteMasterPhase = useCrmOnboardingStore((s) => s.forceCompleteMasterPhase);
  const setMasterNotApplicable = useCrmOnboardingStore((s) => s.setMasterNotApplicable);
  const updateMasterRemarks = useCrmOnboardingStore((s) => s.updateMasterRemarks);
  const updateMasterAssignment = useCrmOnboardingStore((s) => s.updateMasterAssignment);

  const items = record.masterChecklist;
  const pct = calcChecklistProgress(items);
  const counts = countApplicableChecklist(items);

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

  const [phaseDialog, setPhaseDialog] = useState<{
    key: string;
    label: string;
    phase: ChecklistPhase;
    mode: "complete" | "edit" | "force";
  } | null>(null);
  const [phaseDate, setPhaseDate] = useState("");

  function openPhaseDialog(item: CrmMasterChecklistItem, phase: ChecklistPhase) {
    if (!canToggleChecklistPhase(item, phase) && !item[phase]) {
      toast.error("Complete prior steps first", {
        description: "Collected → Uploaded → Live",
      });
      return;
    }
    const at =
      phase === "collected" ? item.collectedAt : phase === "uploaded" ? item.uploadedAt : item.liveAt;
    setPhaseDialog({
      key: item.key,
      label: item.label,
      phase,
      mode: item[phase] ? "edit" : "complete",
    });
    setPhaseDate(phaseAtToYmd(at) || new Date().toISOString().slice(0, 10));
  }

  function openForceCompleteDialog(item: CrmMasterChecklistItem, phase: ChecklistPhase) {
    if (item.notApplicable || item[phase]) return;
    setPhaseDialog({
      key: item.key,
      label: item.label,
      phase,
      mode: "force",
    });
    setPhaseDate(new Date().toISOString().slice(0, 10));
  }

  function confirmPhaseDialog() {
    if (!phaseDialog || !phaseDate) {
      toast.error("Pick a date for this step");
      return;
    }
    if (phaseDialog.mode === "edit") {
      setMasterPhaseDate(companyId, phaseDialog.key, phaseDialog.phase, phaseDate);
      toast.success(`${phaseDialog.phase} date updated`);
    } else if (phaseDialog.mode === "force") {
      forceCompleteMasterPhase(companyId, phaseDialog.key, phaseDialog.phase, phaseDate);
      toast.success(`Marked through ${phaseDialog.phase}`);
    } else {
      toggleMasterPhase(companyId, phaseDialog.key, phaseDialog.phase, phaseDate);
      toast.success(`Marked ${phaseDialog.phase}`);
    }
    setPhaseDialog(null);
  }

  function clearPhaseDialog() {
    if (!phaseDialog) return;
    toggleMasterPhase(companyId, phaseDialog.key, phaseDialog.phase);
    toast.success(`Cleared ${phaseDialog.phase}`);
    setPhaseDialog(null);
  }

  return (
    <>
      <DesignTicketSection
        compact
        title="Master creation · Checklist Detail"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {counts.done}/{counts.total} done
            {counts.na ? ` · ${counts.na} N/A` : ""} · {pct}%
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Track each master through Collected → Uploaded → Live. Mark N/A when an item does not apply.
        </p>
        <ProgressBar value={pct} className="mb-3 h-1.5" />

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {items.map((item) => {
            const na = !!item.notApplicable;
            return (
              <div key={item.key} className={cn("card-soft p-3", na && "bg-muted/20")}>
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("text-xs font-medium", na && "text-muted-foreground line-through")}>
                    {item.label}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMasterNotApplicable(companyId, item.key, !na)}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium",
                      na
                        ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                        : "border-input bg-background text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    N/A
                  </button>
                </div>

                {na ? (
                  <p className="mt-2 text-xs text-muted-foreground">Not applicable for this account</p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["collected", "uploaded", "live"] as const).map((phase) => {
                        const at =
                          phase === "collected"
                            ? item.collectedAt
                            : phase === "uploaded"
                              ? item.uploadedAt
                              : item.liveAt;
                        return (
                          <CrmChecklistPhaseCell
                            key={phase}
                            item={item}
                            phase={phase}
                            na={na}
                            layout="mobile"
                            at={at}
                            onToggle={() => openPhaseDialog(item, phase)}
                            onForceComplete={() => openForceCompleteDialog(item, phase)}
                          />
                        );
                      })}
                    </div>
                    <input
                      value={item.remarks}
                      onChange={(e) => updateMasterRemarks(companyId, item.key, e.target.value)}
                      placeholder="Add note…"
                      className={cn(fieldClass, "mt-3")}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                        onChange={(e) =>
                          updateMasterAssignment(companyId, item.key, {
                            assigneeUserId: crmAssigneeSelectPatch(
                              e.target.value,
                              salesManager.userId,
                            ),
                            dueDate: item.dueDate,
                          })
                        }
                        className={selectClass}
                        aria-label={`Assignee for ${item.label}`}
                      >
                        <option value="">Account manager</option>
                        {assignees.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <DatePickerField
                        compact
                        value={item.dueDate ?? ""}
                        onChange={(v) =>
                          updateMasterAssignment(companyId, item.key, {
                            assigneeUserId: item.assigneeUserId,
                            dueDate: v || undefined,
                          })
                        }
                        placeholder="Due date"
                      />
                    </div>
                  </>
                )}

                {na ? (
                  <input
                    value={item.remarks}
                    onChange={(e) => updateMasterRemarks(companyId, item.key, e.target.value)}
                    placeholder="Why not applicable…"
                    className={cn(fieldClass, "mt-3")}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-lg border md:block">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left">Checklist Item</th>
                <th className="px-2 py-1.5 text-center">Collected</th>
                <th className="px-2 py-1.5 text-center">Uploaded</th>
                <th className="px-2 py-1.5 text-center">Live</th>
                <th className="px-2 py-1.5 text-center">N/A</th>
                <th className="px-2 py-1.5 text-left">Assignee</th>
                <th className="px-2 py-1.5 text-left">Due</th>
                <th className="px-2 py-1.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
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
                    {(["collected", "uploaded", "live"] as const).map((phase) => {
                      const at =
                        phase === "collected"
                          ? item.collectedAt
                          : phase === "uploaded"
                            ? item.uploadedAt
                            : item.liveAt;
                      return (
                        <td key={phase} className="px-2 py-2 text-center">
                          <CrmChecklistPhaseCell
                            item={item}
                            phase={phase}
                            na={na}
                            layout="desktop"
                            at={at}
                            onToggle={() => openPhaseDialog(item, phase)}
                            onForceComplete={() => openForceCompleteDialog(item, phase)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        title={na ? "Mark as applicable" : "Not applicable for this account"}
                        onClick={() => setMasterNotApplicable(companyId, item.key, !na)}
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
                      <select
                        value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                        onChange={(e) =>
                          updateMasterAssignment(companyId, item.key, {
                            assigneeUserId: crmAssigneeSelectPatch(
                              e.target.value,
                              salesManager.userId,
                            ),
                            dueDate: item.dueDate,
                          })
                        }
                        className="h-7 w-32 rounded border bg-background px-1.5 text-[11px]"
                        aria-label={`Assignee for ${item.label}`}
                      >
                        <option value="">Account manager</option>
                        {assignees.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <DatePickerField
                        compact
                        className="w-40"
                        value={item.dueDate ?? ""}
                        onChange={(v) =>
                          updateMasterAssignment(companyId, item.key, {
                            assigneeUserId: item.assigneeUserId,
                            dueDate: v || undefined,
                          })
                        }
                        placeholder="Due date"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.remarks}
                        onChange={(e) => updateMasterRemarks(companyId, item.key, e.target.value)}
                        placeholder={na ? "Why not applicable…" : "Add note…"}
                        className="h-7 w-full min-w-[8rem] rounded border bg-background px-1.5 text-[11px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DesignTicketSection>

      <EntityFormModal
        open={!!phaseDialog}
        onOpenChange={(open) => {
          if (!open) setPhaseDialog(null);
        }}
        title={
          phaseDialog
            ? phaseDialog.mode === "edit"
              ? `Edit ${phaseDialog.phase} date`
              : phaseDialog.mode === "force"
                ? `Mark ${phaseDialog.phase} complete`
                : `Mark ${phaseDialog.phase}`
            : "Phase"
        }
        submitLabel={
          phaseDialog?.mode === "edit"
            ? "Save date"
            : phaseDialog?.mode === "force"
              ? "Mark complete"
              : "Confirm"
        }
        onSubmit={confirmPhaseDialog}
      >
        {phaseDialog ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{phaseDialog.label}</span>
              {phaseDialog.mode === "force" ? (
                <span className="mt-1 block text-xs">
                  Prior steps will also be marked complete with this date.
                </span>
              ) : null}
            </p>
            <label className="block text-xs font-medium">
              {phaseDialog.phase.charAt(0).toUpperCase() + phaseDialog.phase.slice(1)} date
              <DatePickerField
                modal
                className="mt-1"
                value={phaseDate}
                onChange={(v) => setPhaseDate(v)}
              />
            </label>
            {phaseDialog.mode === "edit" ? (
              <Button type="button" variant="outline" className="w-full" onClick={clearPhaseDialog}>
                Clear {phaseDialog.phase}
              </Button>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </>
  );
}
