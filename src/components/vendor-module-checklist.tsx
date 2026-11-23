import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/empty-state";
import { VENDOR_CHECKLIST_GROUPS } from "@/data/constants";
import {
  calcChecklistProgress,
  canToggleChecklistPhase,
  isChecklistItemComplete,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import { useOnboardingStore, useProjectStore } from "@/stores";
import type { ChecklistPhase } from "@/lib/checklist";
import type { OnboardingChecklistItem } from "@/types";

const PHASES: { key: ChecklistPhase; label: string }[] = [
  { key: "collected", label: "Received" },
  { key: "uploaded", label: "Uploaded" },
  { key: "live", label: "Live" },
];

export function VendorModuleChecklist({ companyId }: { companyId: string }) {
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(
    () =>
      allProjects
        .filter((project) => project.companyId === companyId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allProjects, companyId],
  );
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const initChecklistForProject = useOnboardingStore((s) => s.initChecklistForProject);
  const toggleChecklist = useOnboardingStore((s) => s.toggleChecklist);
  const setNotApplicable = useOnboardingStore((s) => s.setChecklistNotApplicable);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  useEffect(() => {
    for (const project of projects) initChecklistForProject(project.id);
  }, [projects, initChecklistForProject]);

  useEffect(() => {
    if (!projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0]?.id ?? "");
    }
  }, [projects, projectId]);

  const projectItems = checklistItems.filter(
    (item) => item.projectId === projectId && item.section === "vendor",
  );
  const byLabel = new Map(projectItems.map((item) => [item.label, item]));
  const progress = calcChecklistProgress(projectItems);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No project yet"
        description="Add a project for this company. Vendor, contractor, and BOQ items are tracked on that project."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="card-soft p-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Vendor, contractor & BOQ</h3>
            <p className="text-xs text-muted-foreground">
              Progress is only these items. It does not copy Post Sales.
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold leading-none">{progress}%</div>
            <div className="text-[10px] text-muted-foreground">this project</div>
          </div>
        </div>
        <ProgressBar value={progress} />
        {projects.length > 1 ? (
          <div className="mt-3 flex gap-1.5 overflow-x-auto">
            {projects.map((project) => {
              const items = checklistItems.filter(
                (item) => item.projectId === project.id && item.section === "vendor",
              );
              const pct = calcChecklistProgress(items);
              const active = project.id === projectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setProjectId(project.id)}
                  className={cn(
                    "shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-xs",
                    active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  )}
                >
                  <div className="max-w-[180px] truncate font-medium">{project.name}</div>
                  <div className="text-[10px] text-muted-foreground">{pct}% vendor</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{projects[0]?.name}</span>
            {projects[0] ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId: projects[0].id }}
                search={{ tab: "onboarding" }}
                className="shrink-0 font-semibold text-primary"
              >
                Open project
              </Link>
            ) : null}
          </div>
        )}
      </div>

      {projectItems.length === 0 ? (
        <div className="card-soft p-4 text-sm text-muted-foreground">
          Loading the vendor checklist for this project.
        </div>
      ) : (
        VENDOR_CHECKLIST_GROUPS.map((group) => {
          const rows = group.items
            .map((label) => byLabel.get(label))
            .filter((item): item is OnboardingChecklistItem => Boolean(item));
          const done = rows.filter((item) => isChecklistItemComplete(item)).length;
          return (
            <section key={group.key} className="card-soft p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {done}/{rows.length || group.items.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((label) => {
                  const item = byLabel.get(label);
                  if (!item) return null;
                  return (
                    <VendorRow
                      key={item.id}
                      item={item}
                      onToggle={(phase) => toggleChecklist(item.id, phase)}
                      onSkip={() => setNotApplicable(item.id, !item.notApplicable)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function VendorRow({
  item,
  onToggle,
  onSkip,
}: {
  item: OnboardingChecklistItem;
  onToggle: (phase: ChecklistPhase) => void;
  onSkip: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        item.notApplicable
          ? "border-border bg-muted/40"
          : isChecklistItemComplete(item)
            ? "border-success/40 bg-success/5"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm font-medium">{item.label}</div>
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium",
            item.notApplicable
              ? "border-muted-foreground/40 bg-muted text-muted-foreground"
              : "border-input text-muted-foreground hover:border-foreground/40",
          )}
        >
          {item.notApplicable ? "Not applicable" : "N/A"}
        </button>
      </div>
      {item.notApplicable ? null : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PHASES.map((phase) => {
            const on = item[phase.key];
            const allowed = canToggleChecklistPhase(item, phase.key);
            return (
              <button
                key={phase.key}
                type="button"
                disabled={!allowed && !on}
                onClick={() => onToggle(phase.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium",
                  on
                    ? "border-success bg-success text-white"
                    : allowed
                      ? "border-input bg-background hover:border-primary"
                      : "cursor-not-allowed border-input bg-muted/40 text-muted-foreground opacity-60",
                )}
              >
                {phase.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
