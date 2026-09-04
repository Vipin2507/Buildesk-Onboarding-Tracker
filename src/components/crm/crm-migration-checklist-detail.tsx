import { useMemo, useState } from "react";
import { Ban, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  ticketFieldClass,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { CrmChecklistMarkAllCompleteButton } from "@/components/crm/crm-checklist-mark-all-complete-button";
import { CrmChecklistPhaseCell } from "@/components/crm/crm-checklist-phase-cell";
import { CrmChecklistStatusFilterBar } from "@/components/crm/crm-checklist-status-filter-bar";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { CRM_MIGRATION_CATEGORIES } from "@/data/crm-onboarding-defaults";
import {
  calcChecklistProgress,
  canToggleChecklistPhase,
  countApplicableChecklist,
  phaseAtToYmd,
  type ChecklistPhase,
} from "@/lib/checklist";
import { resolveCrmMigrationCategories } from "@/lib/crm-migration-catalog";
import {
  crmAssigneeSelectPatch,
  crmAssigneeSelectValue,
  resolveCrmSalesManagerDefaults,
  withCrmSalesManagerOption,
} from "@/lib/crm-sales-manager-defaults";
import {
  countChecklistPhaseStatusFilters,
  matchesChecklistPhaseStatusFilter,
  type CrmChecklistStatusFilter,
} from "@/lib/crm-checklist-filters";
import { useSessionFilter } from "@/hooks/use-session-filter";
import { cn } from "@/lib/utils";
import { useCrmAccountStore, useCrmOnboardingStore, useUserStore } from "@/stores";
import type { CrmMigrationChecklistItem } from "@/types/crm-onboarding";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");

const PHASE_HINT = "Collected (source) → Uploaded → Live (validated)";

export function CrmMigrationChecklistDetail({ companyId }: { companyId: string }) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const account = useCrmAccountStore((s) => s.getById(companyId));
  const users = useUserStore((s) => s.users);
  const toggleMigrationPhase = useCrmOnboardingStore((s) => s.toggleMigrationPhase);
  const setMigrationPhaseDate = useCrmOnboardingStore((s) => s.setMigrationPhaseDate);
  const forceCompleteMigrationItem = useCrmOnboardingStore((s) => s.forceCompleteMigrationItem);
  const setMigrationNotApplicable = useCrmOnboardingStore((s) => s.setMigrationNotApplicable);
  const updateMigrationRemarks = useCrmOnboardingStore((s) => s.updateMigrationRemarks);
  const updateMigrationAssignment = useCrmOnboardingStore((s) => s.updateMigrationAssignment);
  const updateMigrationMeta = useCrmOnboardingStore((s) => s.updateMigrationMeta);
  const adjustMigrationUploadAttempts = useCrmOnboardingStore((s) => s.adjustMigrationUploadAttempts);

  const items = record.migrationChecklist;
  const pct = calcChecklistProgress(items);
  const counts = countApplicableChecklist(items);
  const totalAttempts = items.reduce((s, i) => s + (i.uploadAttempts ?? 0), 0);

  const salesManager = useMemo(
    () => resolveCrmSalesManagerDefaults(account, users),
    [account, users],
  );

  const [categoryFilter, setCategoryFilter] = useSessionFilter(
    `crm.account.${companyId}.migration.category`,
    "all",
  );
  const [statusFilter, setStatusFilter] = useSessionFilter<CrmChecklistStatusFilter>(
    `crm.account.${companyId}.migration.status`,
    "all",
  );
  const statusCounts = useMemo(() => countChecklistPhaseStatusFilters(items), [items]);

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

  const categories = useMemo(() => {
    const fromItems = [
      ...new Set(items.map((i) => i.category ?? "CRM data")),
    ];
    const preferred = resolveCrmMigrationCategories();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const cat of preferred) {
      if (fromItems.includes(cat) && !seen.has(cat)) {
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
    return out.length ? out : [...CRM_MIGRATION_CATEGORIES];
  }, [items]);

  const grouped = useMemo(() => {
    let filtered = items;
    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => matchesChecklistPhaseStatusFilter(i, statusFilter));
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((i) => (i.category ?? "CRM data") === categoryFilter);
    }
    const map = new Map<string, CrmMigrationChecklistItem[]>();
    for (const item of filtered) {
      const cat = item.category ?? "CRM data";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return categories
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [items, categoryFilter, statusFilter, categories]);

  const [phaseDialog, setPhaseDialog] = useState<
    | {
        key: string;
        label: string;
        phase: ChecklistPhase;
        mode: "complete" | "edit";
      }
    | {
        key: string;
        label: string;
        mode: "forceAll";
      }
    | null
  >(null);
  const [phaseDate, setPhaseDate] = useState("");

  function openPhaseDialog(item: CrmMigrationChecklistItem, phase: ChecklistPhase) {
    if (!canToggleChecklistPhase(item, phase) && !item[phase]) {
      toast.error("Complete prior steps first", { description: PHASE_HINT });
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

  function openMarkAllCompleteDialog(item: CrmMigrationChecklistItem) {
    if (item.notApplicable || (item.collected && item.uploaded && item.live)) return;
    setPhaseDialog({
      key: item.key,
      label: item.label,
      mode: "forceAll",
    });
    setPhaseDate(new Date().toISOString().slice(0, 10));
  }

  function confirmPhaseDialog() {
    if (!phaseDialog || !phaseDate) {
      toast.error("Pick a date for this step");
      return;
    }
    if (phaseDialog.mode === "forceAll") {
      forceCompleteMigrationItem(companyId, phaseDialog.key, phaseDate);
      toast.success("All steps marked complete · upload counted");
    } else if (phaseDialog.mode === "edit") {
      setMigrationPhaseDate(companyId, phaseDialog.key, phaseDialog.phase, phaseDate);
      toast.success(`${phaseDialog.phase} date updated`);
    } else {
      toggleMigrationPhase(companyId, phaseDialog.key, phaseDialog.phase, phaseDate);
      toast.success(
        phaseDialog.phase === "uploaded"
          ? `Marked uploaded · attempt counted`
          : `Marked ${phaseDialog.phase}`,
      );
    }
    setPhaseDialog(null);
  }

  function clearPhaseDialog() {
    if (!phaseDialog || phaseDialog.mode === "forceAll") return;
    toggleMigrationPhase(companyId, phaseDialog.key, phaseDialog.phase);
    toast.success(`Cleared ${phaseDialog.phase}`);
    setPhaseDialog(null);
  }

  return (
    <>
      <DesignTicketSection
        compact
        title="Data migration · Checklist Detail"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {counts.done}/{counts.total} done
            {counts.na ? ` · ${counts.na} N/A` : ""} · {totalAttempts} uploads · {pct}%
          </span>
        }
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          Track each dataset through source collection → upload → live validation. Use the upload
          counter when the same data is migrated more than once.
        </p>
        <ProgressBar value={pct} className="mb-3 h-1.5" />

        <CrmChecklistStatusFilterBar
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
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
          {categories.map((cat) => {
            const count = items.filter((i) => (i.category ?? "CRM data") === cat).length;
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
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>

              {/* Mobile */}
              <div className="space-y-2 md:hidden">
                {catItems.map((item) => {
                  const na = !!item.notApplicable;
                  return (
                    <div key={item.key} className={cn("card-soft space-y-2 p-3", na && "bg-muted/20")}>
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            na && "text-muted-foreground line-through",
                          )}
                        >
                          {item.label}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMigrationNotApplicable(companyId, item.key, !na)}
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
                        <>
                          <p className="text-xs text-muted-foreground">Not applicable for this account</p>
                          <input
                            value={item.remarks}
                            onChange={(e) =>
                              updateMigrationRemarks(companyId, item.key, e.target.value)
                            }
                            placeholder="Why not applicable…"
                            className={fieldClass}
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {(["collected", "uploaded", "live"] as const).map((phase) => {
                              const at =
                                phase === "collected"
                                  ? item.collectedAt
                                  : phase === "uploaded"
                                    ? item.uploadedAt
                                    : item.liveAt;
                              const label =
                                phase === "collected"
                                  ? "Collected"
                                  : phase === "uploaded"
                                    ? "Uploaded"
                                    : "Live";
                              return (
                                <CrmChecklistPhaseCell
                                  key={phase}
                                  item={item}
                                  phase={phase}
                                  na={na}
                                  label={label}
                                  layout="mobile"
                                  priorStepsHint={PHASE_HINT}
                                  at={at}
                                  onToggle={() => openPhaseDialog(item, phase)}
                                />
                              );
                            })}
                          </div>
                          <CrmChecklistMarkAllCompleteButton
                            item={item}
                            na={na}
                            layout="mobile"
                            onClick={() => openMarkAllCompleteDialog(item)}
                          />

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground">Upload attempts</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={(item.uploadAttempts ?? 0) <= 0}
                                onClick={() =>
                                  adjustMigrationUploadAttempts(companyId, item.key, -1)
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                                {item.uploadAttempts ?? 0}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  adjustMigrationUploadAttempts(companyId, item.key, 1);
                                  toast.success(`+1 upload · ${item.label}`);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <input
                            className={fieldClass}
                            placeholder="Source file / sheet…"
                            value={item.sourceFile ?? ""}
                            onChange={(e) =>
                              updateMigrationMeta(companyId, item.key, {
                                sourceFile: e.target.value,
                              })
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            className={fieldClass}
                            placeholder="Record count"
                            value={item.recordCount ?? ""}
                            onChange={(e) =>
                              updateMigrationMeta(companyId, item.key, {
                                recordCount: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                          />
                          <input
                            value={item.remarks}
                            onChange={(e) =>
                              updateMigrationRemarks(companyId, item.key, e.target.value)
                            }
                            placeholder="Remarks / issues…"
                            className={fieldClass}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                              onChange={(e) =>
                                updateMigrationAssignment(companyId, item.key, {
                                  assigneeUserId: crmAssigneeSelectPatch(
                                    e.target.value,
                                    salesManager.userId,
                                  ),
                                  dueDate: item.dueDate,
                                })
                              }
                              className={selectClass}
                            >
                              <option value="">Assignee</option>
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
                                updateMigrationAssignment(companyId, item.key, {
                                  assigneeUserId: item.assigneeUserId,
                                  dueDate: v || undefined,
                                })
                              }
                              placeholder="Due date"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[960px] text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Dataset</th>
                      <th className="px-2 py-1.5 text-center">Collected</th>
                      <th className="px-2 py-1.5 text-center">Uploaded</th>
                      <th className="px-2 py-1.5 text-center">Live</th>
                      <th className="px-2 py-1.5 text-center">Mark complete</th>
                      <th className="px-2 py-1.5 text-center">N/A</th>
                      <th className="px-2 py-1.5 text-center">Attempts</th>
                      <th className="px-2 py-1.5 text-left">Source / records</th>
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
                                  priorStepsHint={PHASE_HINT}
                                  at={at}
                                  onToggle={() => openPhaseDialog(item, phase)}
                                />
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center">
                            <CrmChecklistMarkAllCompleteButton
                              item={item}
                              na={na}
                              layout="desktop"
                              onClick={() => openMarkAllCompleteDialog(item)}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setMigrationNotApplicable(companyId, item.key, !na)}
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
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={na || (item.uploadAttempts ?? 0) <= 0}
                                onClick={() =>
                                  adjustMigrationUploadAttempts(companyId, item.key, -1)
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="min-w-[1.5rem] text-center font-semibold tabular-nums">
                                {item.uploadAttempts ?? 0}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={na}
                                onClick={() => {
                                  adjustMigrationUploadAttempts(companyId, item.key, 1);
                                  toast.success(`+1 upload · ${item.label}`);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="space-y-1">
                              <input
                                disabled={na}
                                className="h-7 w-32 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                                placeholder="Source file"
                                value={item.sourceFile ?? ""}
                                onChange={(e) =>
                                  updateMigrationMeta(companyId, item.key, {
                                    sourceFile: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="number"
                                min={0}
                                disabled={na}
                                className="h-7 w-24 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                                placeholder="Records"
                                value={item.recordCount ?? ""}
                                onChange={(e) =>
                                  updateMigrationMeta(companyId, item.key, {
                                    recordCount:
                                      e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              disabled={na}
                              value={crmAssigneeSelectValue(item.assigneeUserId, salesManager.userId)}
                              onChange={(e) =>
                                updateMigrationAssignment(companyId, item.key, {
                                  assigneeUserId: crmAssigneeSelectPatch(
                                    e.target.value,
                                    salesManager.userId,
                                  ),
                                  dueDate: item.dueDate,
                                })
                              }
                              className="h-7 w-28 rounded border bg-background px-1.5 text-[11px] disabled:opacity-50"
                            >
                              <option value="">Unassigned</option>
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
                              disabled={na}
                              className="w-40"
                              value={item.dueDate ?? ""}
                              onChange={(v) =>
                                updateMigrationAssignment(companyId, item.key, {
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
                              onChange={(e) =>
                                updateMigrationRemarks(companyId, item.key, e.target.value)
                              }
                              placeholder={na ? "Why not applicable…" : "Remarks…"}
                              className="h-7 w-full min-w-[8rem] rounded border bg-background px-1.5 text-[11px]"
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
        open={!!phaseDialog}
        onOpenChange={(open) => {
          if (!open) setPhaseDialog(null);
        }}
        title={
          phaseDialog
            ? phaseDialog.mode === "forceAll"
              ? "Mark all steps complete"
              : phaseDialog.mode === "edit"
                ? `Edit ${phaseDialog.phase} date`
                : `Mark ${phaseDialog.phase}`
            : "Phase"
        }
        submitLabel={
          phaseDialog?.mode === "forceAll"
            ? "Mark complete"
            : phaseDialog?.mode === "edit"
              ? "Save date"
              : "Confirm"
        }
        onSubmit={confirmPhaseDialog}
      >
        {phaseDialog ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{phaseDialog.label}</span>
              {phaseDialog.mode === "forceAll" ? (
                <span className="mt-1 block text-xs">
                  Collected, Uploaded, and Live will all be marked complete with this date. This
                  will also increment the upload attempt counter if Uploaded was not already done.
                </span>
              ) : phaseDialog.mode === "complete" && phaseDialog.phase === "uploaded" ? (
                <span className="mt-1 block text-xs">This will also increment the upload attempt counter.</span>
              ) : null}
            </p>
            <label className="block text-xs font-medium">
              {phaseDialog.mode === "forceAll"
                ? "Completion date"
                : `${phaseDialog.phase.charAt(0).toUpperCase()}${phaseDialog.phase.slice(1)} date`}
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
