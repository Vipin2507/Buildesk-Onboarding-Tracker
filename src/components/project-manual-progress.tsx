import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ban, Check, CheckCheck, Eraser, Rocket } from "lucide-react";
import { toast } from "sonner";

import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { useCompanyStore, useProjectProgressStore, useProjectStore } from "@/stores";
import { PROJECT_PROGRESS_MILESTONES, type ProjectProgressMilestoneKey } from "@/types/project";
import { cn } from "@/lib/utils";

const GROUPS = [
  "Setup & Data",
  "Document Formats",
  "Customer App",
  "Integrations",
  "Procurement",
  "Labor",
  "Close-out",
] as const;

export function ProjectManualProgress({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === project?.companyId));
  const projectCount = useProjectStore(
    (s) => s.projects.filter((p) => p.companyId === project?.companyId).length,
  );

  const ensure = useProjectProgressStore((s) => s.ensure);
  const progress = useProjectProgressStore((s) => s.byProjectId[projectId]);
  const toggleCheck = useProjectProgressStore((s) => s.toggleCheck);
  const toggleNotApplicable = useProjectProgressStore((s) => s.toggleNotApplicable);
  const updateMeta = useProjectProgressStore((s) => s.updateMeta);
  const markAll = useProjectProgressStore((s) => s.markAll);
  const calcPercent = useProjectProgressStore((s) => s.calcPercent);
  const completeProject = useProjectStore((s) => s.completeProject);

  const [remarks, setRemarks] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [pulseKey, setPulseKey] = useState<string | null>(null);

  useEffect(() => {
    ensure(projectId);
  }, [ensure, projectId]);

  useEffect(() => {
    if (!progress) return;
    setRemarks((prev) => (prev === (progress.remarks ?? "") ? prev : progress.remarks ?? ""));
    const nextPerson =
      progress.contactPerson ?? project?.pocName ?? company?.pocName ?? company?.contact ?? "";
    const nextNumber =
      progress.contactNumber ?? project?.pocMobile ?? company?.pocMobile ?? company?.phone ?? "";
    setContactPerson((prev) => (prev === nextPerson ? prev : nextPerson));
    setContactNumber((prev) => (prev === nextNumber ? prev : nextNumber));
  }, [
    progress,
    project?.pocName,
    project?.pocMobile,
    company?.pocName,
    company?.pocMobile,
    company?.contact,
    company?.phone,
  ]);

  const percent = calcPercent(projectId);
  const naMap = progress?.notApplicable ?? {};
  const applicableTotal = useMemo(
    () => PROJECT_PROGRESS_MILESTONES.filter((m) => !naMap[m.key]).length,
    [naMap],
  );
  const doneCount = useMemo(
    () =>
      PROJECT_PROGRESS_MILESTONES.filter((m) => !naMap[m.key] && progress?.checks[m.key]).length,
    [progress, naMap],
  );
  const total = PROJECT_PROGRESS_MILESTONES.length;
  const naCount = total - applicableTotal;
  const alreadyComplete = project?.status === "completed";

  function onToggle(key: ProjectProgressMilestoneKey) {
    if (progress?.notApplicable?.[key]) return;
    toggleCheck(projectId, key);
    setPulseKey(key);
    window.setTimeout(() => setPulseKey((k) => (k === key ? null : k)), 450);
  }

  function onToggleNa(e: React.MouseEvent, key: ProjectProgressMilestoneKey) {
    e.stopPropagation();
    toggleNotApplicable(projectId, key);
  }

  function saveMeta() {
    updateMeta(projectId, {
      contactPerson: contactPerson.trim() || undefined,
      contactNumber: contactNumber.trim() || undefined,
      remarks: remarks.trim(),
    });
    toast.success("Progress details saved");
  }

  if (!project) return null;

  return (
    <div className="space-y-5">
      <div className="card-soft overflow-hidden p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Manual Progress Tracker</h3>
            <p className="text-sm text-muted-foreground">
              Shared with Onboarding: checking milestones here updates matching checklist
              rows (and the reverse when a checklist item is fully completed). Mark all also
              completes the onboarding checklist.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="bg-primary"
              disabled={alreadyComplete && percent === 100}
              onClick={() => {
                completeProject(projectId);
                toast.success("Project completed", {
                  description: "Progress Tracker and onboarding checklist marked complete.",
                });
              }}
            >
              <Rocket className="mr-1 h-3.5 w-3.5" /> Complete project
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                markAll(projectId, true);
                toast.success("All milestones marked complete", {
                  description: "Matching onboarding checklist items were updated too.",
                });
              }}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                markAll(projectId, false);
                toast.message("All milestones cleared", {
                  description: "Mapped onboarding checklist rows were reset.",
                });
              }}
            >
              <Eraser className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {doneCount} of {applicableTotal} milestones
            {naCount > 0 ? ` · ${naCount} N/A excluded` : ""}
          </span>
          <motion.span
            key={percent}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="font-semibold tabular-nums text-primary"
          >
            {percent}%
          </motion.span>
        </div>
        <ProgressBar value={percent} className="h-3" />
      </div>

      <div className="card-soft p-5">
        <h4 className="mb-3 text-sm font-semibold">Project Info</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoField label="Company Name" value={company?.name ?? "—"} readOnly />
          <label className="block text-xs font-medium">
            Contact Person
            <input
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              onBlur={saveMeta}
            />
          </label>
          <label className="block text-xs font-medium">
            Contact Number
            <input
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              onBlur={saveMeta}
            />
          </label>
          <InfoField label="No. of Projects" value={String(projectCount)} readOnly />
        </div>
      </div>

      <div className="space-y-4">
        {GROUPS.map((group) => {
          const items = PROJECT_PROGRESS_MILESTONES.filter((m) => m.group === group);
          const groupDone = items.filter(
            (m) => progress?.checks[m.key] || progress?.notApplicable?.[m.key],
          ).length;
          const groupPct = items.length ? Math.round((groupDone / items.length) * 100) : 0;

          return (
            <div key={group} className="card-soft p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{group}</h4>
                  <p className="text-xs text-muted-foreground">
                    {groupDone}/{items.length} complete
                  </p>
                </div>
                <div className="w-28">
                  <ProgressBar value={groupPct} className="h-1.5" />
                </div>
              </div>

              <div className={cn(
                "grid gap-2",
                group === "Integrations" || group === "Labor"
                  ? "sm:grid-cols-1 xl:grid-cols-2"
                  : "sm:grid-cols-2 xl:grid-cols-3",
              )}>
                {items.map((item) => {
                  const na = Boolean(progress?.notApplicable?.[item.key]);
                  const checked = Boolean(progress?.checks[item.key]) && !na;
                  const pulsing = pulseKey === item.key;
                  const description =
                    "description" in item && typeof item.description === "string"
                      ? item.description
                      : undefined;
                  const showLiveBadge = group === "Integrations" || group === "Labor" || group === "Customer App";
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-2 py-2 transition-colors",
                        na
                          ? "border-border bg-muted/30"
                          : checked
                            ? "border-success/40 bg-success/10"
                            : "border-border bg-card",
                      )}
                    >
                      <motion.button
                        type="button"
                        layout
                        disabled={na}
                        onClick={() => onToggle(item.key)}
                        whileTap={na ? undefined : { scale: 0.98 }}
                        animate={
                          pulsing
                            ? {
                                scale: [1, 1.03, 1],
                                boxShadow: [
                                  "0 0 0 0 rgba(0,155,255,0)",
                                  "0 0 0 6px rgba(0,155,255,0.18)",
                                  "0 0 0 0 rgba(0,155,255,0)",
                                ],
                              }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-3 rounded-md px-1.5 py-1 text-left",
                          na && "cursor-default opacity-70",
                          !na && "hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                            na
                              ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                              : checked
                                ? "border-success bg-success text-white"
                                : "border-input bg-background text-transparent",
                          )}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {na ? (
                              <motion.span
                                key="na"
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </motion.span>
                            ) : (
                              checked && (
                                <motion.span
                                  key="check"
                                  initial={{ scale: 0.4, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.4, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                                >
                                  <Check className="h-4 w-4" />
                                </motion.span>
                              )
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              na && "text-muted-foreground line-through",
                              checked && "text-foreground",
                            )}
                          >
                            {item.label}
                          </span>
                          {description ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                          ) : null}
                          {showLiveBadge && !na ? (
                            <span
                              className={cn(
                                "mt-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                checked
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {checked ? "Live" : "Not Live"}
                            </span>
                          ) : null}
                        </span>
                      </motion.button>
                      <button
                        type="button"
                        title={na ? "Mark as applicable" : "Not applicable for this project"}
                        onClick={(e) => onToggleNa(e, item.key)}
                        className={cn(
                          "mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide",
                          na
                            ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                            : "border-input text-muted-foreground hover:border-foreground/40 hover:bg-muted/50",
                        )}
                      >
                        <Ban className="h-3 w-3" />
                        N/A
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-soft p-5">
        <label className="block text-sm font-semibold">
          Remarks
          <textarea
            className="mt-2 min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="Notes for this project's progress…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            onBlur={saveMeta}
          />
        </label>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={saveMeta}>
            Save Remarks
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  readOnly,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <input
        readOnly={readOnly}
        className={cn(
          "mt-1 h-9 w-full rounded-md border px-3 text-sm",
          readOnly ? "cursor-default bg-muted/40 text-foreground" : "bg-background",
        )}
        value={value}
      />
    </label>
  );
}
