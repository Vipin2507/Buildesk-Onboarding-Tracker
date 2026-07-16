import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Clock, ChevronRight, ArrowLeft, Rocket, Ban } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { ProjectManualProgress } from "@/components/project-manual-progress";
import { ProjectDocumentsPanel } from "@/components/project-documents-panel";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useProjectStore,
  useOnboardingStore,
  useActivityStore,
  useProjectProgressStore,
  calcProjectProgress,
} from "@/stores";
import { ONBOARDING_STEPS, ONBOARDING_SECTIONS } from "@/data/constants";
import { formatRelativeTime } from "@/types/common";
import { PROJECT_PROGRESS_MILESTONES } from "@/types/project";
import { calcChecklistProgress, canToggleChecklistPhase, countApplicableChecklist } from "@/lib/checklist";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type OnboardingSectionKey = (typeof ONBOARDING_SECTIONS)[number]["key"];

const STEP_TO_SECTION: OnboardingSectionKey[] = [
  "project", // 0 Project Details
  "project", // 1 Other Charges
  "unit", // 2 Unit Configuration
  "customer", // 3 Customer Data Upload
  "payment", // 4 Payment Data Upload
  "documents", // 5 Documents Upload
  "integrations", // 6 Payment Plan / Integrations
  "golive", // 7 Review & Complete
];

const SECTION_TO_STEP: Record<OnboardingSectionKey, number> = {
  project: 0,
  unit: 2,
  customer: 3,
  payment: 4,
  documents: 5,
  integrations: 6,
  golive: 7,
};

function sectionForStep(step: number): OnboardingSectionKey {
  return STEP_TO_SECTION[Math.max(0, Math.min(step, STEP_TO_SECTION.length - 1))] ?? "project";
}

function stepForSection(sectionKey: string): number {
  return SECTION_TO_STEP[sectionKey as OnboardingSectionKey] ?? 0;
}

const searchSchema = z.object({
  tab: z
    .enum(["progress", "onboarding", "documents"])
    .optional()
    .default("progress"),
});

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/projects/$projectId" });
  const loading = useDetailLoading();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === project?.companyId));
  const allChecklist = useOnboardingStore((s) => s.checklistItems);
  const allCharges = useOnboardingStore((s) => s.otherCharges);
  const allActivities = useActivityStore((s) => s.activities);
  const checklist = useMemo(() => allChecklist.filter((i) => i.projectId === projectId), [allChecklist, projectId]);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId[projectId]);
  const checklistProgress = useMemo(
    () => calcProjectProgress(projectId, allChecklist),
    [projectId, allChecklist, progressByProject],
  );
  const manualChecks = progressByProject?.checks;
  const manualNa = progressByProject?.notApplicable;
  const manualPercent = useMemo(() => {
    if (!manualChecks && !manualNa) return 0;
    const na = manualNa ?? {};
    const applicable = PROJECT_PROGRESS_MILESTONES.filter((m) => !na[m.key]);
    if (applicable.length === 0) return 100;
    const done = applicable.filter((m) => manualChecks?.[m.key]).length;
    return Math.round((done / applicable.length) * 100);
  }, [manualChecks, manualNa]);
  const progress = Math.max(checklistProgress, manualPercent);
  const canGoLive = useMemo(
    () => {
      const goliveItems = checklist.filter((i) => i.section === "golive");
      return (
        goliveItems.length > 0 &&
        goliveItems.every((i) => i.notApplicable || (i.collected && i.uploaded && i.live))
      );
    },
    [checklist],
  );
  const toggleChecklist = useOnboardingStore((s) => s.toggleChecklist);
  const setNotApplicable = useOnboardingStore((s) => s.setChecklistNotApplicable);
  const updateRemarks = useOnboardingStore((s) => s.updateChecklistRemarks);
  const initChecklistForProject = useOnboardingStore((s) => s.initChecklistForProject);
  const goLive = useProjectStore((s) => s.goLive);

  useEffect(() => {
    initChecklistForProject(projectId);
    useProjectProgressStore.getState().ensure(projectId);
  }, [projectId, initChecklistForProject]);
  const updateProject = useProjectStore((s) => s.updateProject);
  const activities = useMemo(
    () => allActivities.filter((a) => a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allActivities, projectId],
  );
  const otherCharges = useMemo(() => allCharges.filter((c) => c.projectId === projectId), [allCharges, projectId]);
  const addOtherCharge = useOnboardingStore((s) => s.addOtherCharge);
  const deleteOtherCharge = useOnboardingStore((s) => s.deleteOtherCharge);

  const [currentStep, setCurrentStep] = useState(project?.currentStep ?? 0);
  const [section, setSection] = useState<OnboardingSectionKey>(() =>
    sectionForStep(project?.currentStep ?? 0),
  );
  const [goLiveAnim, setGoLiveAnim] = useState(false);

  function goToStep(step: number) {
    const next = Math.max(0, Math.min(step, ONBOARDING_STEPS.length - 1));
    setCurrentStep(next);
    setSection(sectionForStep(next));
    updateProject(projectId, { currentStep: next });
  }

  function goToSection(sectionKey: OnboardingSectionKey) {
    setSection(sectionKey);
    const next = stepForSection(sectionKey);
    setCurrentStep(next);
    updateProject(projectId, { currentStep: next });
  }

  const sectionItems = useMemo(() => {
    const map: Record<string, typeof checklist> = {};
    for (const item of checklist) {
      (map[item.section] ??= []).push(item);
    }
    return map;
  }, [checklist]);

  if (loading) return <DetailPageSkeleton />;
  if (!project) {
    return <EntityNotFound entity="Project" listPath="/companies" listLabel="Companies" />;
  }

  const projectName = project.name;

  const TABS = [
    { key: "progress", label: "Progress Tracker" },
    { key: "onboarding", label: "Checklist Detail" },
    { key: "documents", label: "Documents" },
  ] as const;

  function handleGoLive() {
    if (!canGoLive) {
      toast.error("Complete all Go-Live checklist items first");
      return;
    }
    const ok = goLive(projectId);
    if (ok) {
      setGoLiveAnim(true);
      toast.success("🎉 Project is LIVE!", { description: `${projectName} has gone live.` });
      setTimeout(() => setGoLiveAnim(false), 2000);
    }
  }

  function sectionProgress(sec: string) {
    const items = sectionItems[sec] ?? [];
    return calcChecklistProgress(items);
  }

  return (
    <PageWrap>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/companies/$companyId"
            params={{ companyId: project.companyId }}
            search={{ tab: "Project" }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Company
          </Link>
        </Button>
      </div>

      <PageHeader
        title={project.name}
        subtitle={`${company?.name ?? ""} · ${project.city}${project.pocName ? ` · POC ${project.pocName}` : ""}${project.startDate ? ` · Started ${formatDate(project.startDate)}` : ""} · Track milestones in Progress; use Checklist for phase-level detail`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{progress}% complete</span>
            <Button
              className={cn("gap-1.5 bg-primary", goLiveAnim && "animate-pulse ring-4 ring-success/40")}
              disabled={!canGoLive || !!project.goLiveAt}
              onClick={handleGoLive}
            >
              <Rocket className="h-4 w-4" /> {project.goLiveAt ? "Live" : "Go Live"}
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <ProgressBar value={progress} className="h-2" />
      </div>

      <div className="card-soft mb-6 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate({ search: { tab: t.key } })}
            className={cn(
              "min-h-10 shrink-0 rounded-md px-3 py-2 text-xs font-medium md:py-1.5",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >{t.label}</button>
        ))}
      </div>

      {tab === "progress" && <ProjectManualProgress projectId={projectId} />}

      {tab === "onboarding" && (
        <>
          <div className="card-soft mb-6 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Current Step</div>
                <div className="font-semibold">{ONBOARDING_STEPS[currentStep]}</div>
              </div>
              <div className="text-xs text-muted-foreground">Step {currentStep + 1} of {ONBOARDING_STEPS.length}</div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={s} className="flex flex-1 items-center gap-1 min-w-[110px]">
                    <button onClick={() => goToStep(i)} className="group flex flex-col items-center gap-1.5">
                      <motion.div
                        initial={false}
                        animate={{ scale: active ? 1.1 : 1, backgroundColor: done ? "var(--color-success)" : active ? "var(--color-primary)" : "var(--color-muted)" }}
                        className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white", active && "ring-4 ring-primary/25")}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </motion.div>
                      <span className={cn("text-[11px] max-w-[110px] text-center", active ? "font-semibold" : "text-muted-foreground")}>{s}</span>
                    </button>
                    {i < ONBOARDING_STEPS.length - 1 && (
                      <div className="mb-4 h-0.5 flex-1 bg-muted">
                        <motion.div animate={{ width: done ? "100%" : "0%" }} className="h-full bg-success" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <nav className="card-soft flex h-fit gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:overflow-visible">
              {ONBOARDING_SECTIONS.map((s) => {
                const active = s.key === section;
                const pct = sectionProgress(s.key);
                const items = sectionItems[s.key] ?? [];
                const { done, total, na } = countApplicableChecklist(items);
                return (
                  <button key={s.key} onClick={() => goToSection(s.key)} className={cn("relative flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm lg:min-w-0 lg:w-full", active ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
                    <div className="flex-1">
                      <div className="font-medium">{s.label}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar value={pct} className="h-1 w-24" />
                        <span className="text-[10px] text-muted-foreground">
                          {done}/{total}
                          {na > 0 ? ` · ${na} N/A` : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={section} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="card-soft p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-semibold">{ONBOARDING_SECTIONS.find((s) => s.key === section)?.label}</h3>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const idx = ONBOARDING_SECTIONS.findIndex((s) => s.key === section);
                        if (idx < 0) return;
                        if (idx >= ONBOARDING_SECTIONS.length - 1) {
                          goToStep(ONBOARDING_STEPS.length - 1);
                          toast.success("Last section saved — checklist is ready for Go Live");
                          return;
                        }
                        const next = ONBOARDING_SECTIONS[idx + 1]!;
                        goToSection(next.key);
                        toast.success(`Saved — moved to ${next.label}`);
                      }}
                    >
                      Save & Continue <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>

                  {section === "project" && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Other Charges</h4>
                        <Button size="sm" variant="outline" onClick={() => addOtherCharge({ projectId, name: "New Charge", amount: 0, type: "One-time" })}>+ Add</Button>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {otherCharges.map((c) => (
                            <tr key={c.id} className="border-t">
                              <td className="py-2"><input defaultValue={c.name} onBlur={(e) => useOnboardingStore.getState().updateOtherCharge(c.id, { name: e.target.value })} className="w-full rounded border px-2 py-1 text-sm" /></td>
                              <td className="py-2"><input type="number" defaultValue={c.amount} onBlur={(e) => useOnboardingStore.getState().updateOtherCharge(c.id, { amount: Number(e.target.value) })} className="w-24 rounded border px-2 py-1 text-sm" /></td>
                              <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => deleteOtherCharge(c.id)}>×</Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="space-y-3 md:hidden">
                    {(sectionItems[section] ?? []).map((item) => {
                      const na = !!item.notApplicable;
                      return (
                      <div key={item.id} className={cn("rounded-xl border border-border p-3.5", na && "bg-muted/30 opacity-90")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn("font-medium text-sm", na && "text-muted-foreground line-through")}>
                            {item.label}
                            {item.source === "required-document" && (
                              <span className="ml-2 inline-flex align-middle rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Required
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotApplicable(item.id, !na)}
                            className={cn(
                              "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium",
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
                          <p className="mt-2 text-xs text-muted-foreground">Not applicable for this project</p>
                        ) : (
                          <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["collected", "uploaded", "live"] as const).map((phase) => {
                            const allowed = canToggleChecklistPhase(item, phase);
                            const at =
                              phase === "collected"
                                ? item.collectedAt
                                : phase === "uploaded"
                                  ? item.uploadedAt
                                  : item.liveAt;
                            return (
                            <button
                              key={phase}
                              type="button"
                              disabled={!allowed && !item[phase]}
                              title={
                                !allowed && !item[phase]
                                  ? "Complete prior steps first (Collected → Uploaded → Live)"
                                  : at
                                    ? formatDateTime(at)
                                    : undefined
                              }
                              onClick={() => {
                                if (!canToggleChecklistPhase(item, phase) && !item[phase]) {
                                  toast.error("Complete prior steps first", {
                                    description: "Collected → Uploaded → Live",
                                  });
                                  return;
                                }
                                toggleChecklist(item.id, phase);
                              }}
                              className={cn(
                                "inline-flex min-h-10 min-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize",
                                item[phase]
                                  ? "border-success bg-success text-white"
                                  : allowed
                                    ? "border-input bg-background hover:border-primary"
                                    : "cursor-not-allowed border-input bg-muted/40 text-muted-foreground opacity-50",
                              )}
                            >
                              <span className="inline-flex items-center gap-1">
                                {item[phase] && <Check className="h-3.5 w-3.5" />}
                                {phase}
                              </span>
                              {item[phase] && at ? (
                                <span className="text-[9px] font-normal opacity-90 normal-case">
                                  {formatDate(at)}
                                </span>
                              ) : null}
                            </button>
                            );
                          })}
                        </div>
                        <input
                          value={item.remarks}
                          onChange={(e) => updateRemarks(item.id, e.target.value)}
                          placeholder="Add note…"
                          className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm"
                        />
                          </>
                        )}
                        {na && (
                          <input
                            value={item.remarks}
                            onChange={(e) => updateRemarks(item.id, e.target.value)}
                            placeholder="Why not applicable…"
                            className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm"
                          />
                        )}
                      </div>
                    );
                    })}
                  </div>

                  <div className="hidden overflow-hidden rounded-lg border md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left">Checklist Item</th>
                          <th className="px-3 py-2 text-center">Collected</th>
                          <th className="px-3 py-2 text-center">Uploaded</th>
                          <th className="px-3 py-2 text-center">Live</th>
                          <th className="px-3 py-2 text-center">N/A</th>
                          <th className="px-3 py-2 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sectionItems[section] ?? []).map((item) => {
                          const na = !!item.notApplicable;
                          return (
                          <tr key={item.id} className={cn("border-t", na && "bg-muted/20")}>
                            <td className={cn("px-4 py-3 font-medium", na && "text-muted-foreground line-through")}>
                              {item.label}
                              {item.source === "required-document" && (
                                <span className="ml-2 inline-flex align-middle rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Required
                                </span>
                              )}
                            </td>
                            {(["collected", "uploaded", "live"] as const).map((phase) => {
                              const allowed = !na && canToggleChecklistPhase(item, phase);
                              const at =
                                phase === "collected"
                                  ? item.collectedAt
                                  : phase === "uploaded"
                                    ? item.uploadedAt
                                    : item.liveAt;
                              return (
                              <td key={phase} className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={na || (!allowed && !item[phase])}
                                  title={
                                    na
                                      ? "Not applicable"
                                      : !allowed && !item[phase]
                                        ? "Complete prior steps first"
                                        : at
                                          ? formatDateTime(at)
                                          : undefined
                                  }
                                  onClick={() => {
                                    if (!canToggleChecklistPhase(item, phase) && !item[phase]) {
                                      toast.error("Complete prior steps first", {
                                        description: "Collected → Uploaded → Live",
                                      });
                                      return;
                                    }
                                    toggleChecklist(item.id, phase);
                                  }}
                                  className={cn(
                                    "inline-flex min-h-9 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 py-1",
                                    (na || (!allowed && !item[phase])) && "cursor-not-allowed opacity-40",
                                    !na && item[phase] && "border-success bg-success text-white",
                                    !na && !item[phase] && allowed && "border-input hover:border-primary",
                                  )}
                                >
                                  {!na && item[phase] && <Check className="h-3.5 w-3.5" />}
                                  {na && <span className="text-[10px] text-muted-foreground">—</span>}
                                  {!na && item[phase] && at ? (
                                    <span className="text-[9px] font-normal leading-tight opacity-90">
                                      {formatDate(at)}
                                    </span>
                                  ) : null}
                                </button>
                              </td>
                              );
                            })}
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                title={na ? "Mark as applicable" : "Not applicable for this project"}
                                onClick={() => setNotApplicable(item.id, !na)}
                                className={cn(
                                  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                                  na
                                    ? "border-muted-foreground/50 bg-muted text-muted-foreground"
                                    : "border-input hover:border-foreground/40 hover:bg-muted/50",
                                )}
                              >
                                <Ban className="h-3 w-3" />
                                N/A
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                value={item.remarks}
                                onChange={(e) => updateRemarks(item.id, e.target.value)}
                                placeholder={na ? "Why not applicable…" : "Add note…"}
                                className="h-8 w-full rounded border bg-background px-2 text-xs"
                              />
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6">
                    <h4 className="mb-3 text-sm font-semibold">Activity Log</h4>
                    <ol className="relative space-y-4 border-l-2 border-border pl-4">
                      {activities.slice(0, 5).map((a) => (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                          <div className="text-sm font-medium">{a.what}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatRelativeTime(a.createdAt)} · {a.who}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {tab === "documents" && <ProjectDocumentsPanel projectId={projectId} />}
    </PageWrap>
  );
}
