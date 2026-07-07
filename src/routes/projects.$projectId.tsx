import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Clock, ChevronRight, ArrowLeft, Rocket } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useProjectStore,
  useOnboardingStore,
  useActivityStore,
  calcProjectProgress,
} from "@/stores";
import { ONBOARDING_STEPS, ONBOARDING_SECTIONS } from "@/data/constants";
import { formatRelativeTime } from "@/types/common";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum([
    "onboarding", "data-migration", "documents", "customer-app",
    "vendors", "labor", "integrations", "training", "go-live",
  ]).optional().default("onboarding"),
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
  const progress = useMemo(() => calcProjectProgress(projectId, allChecklist), [projectId, allChecklist]);
  const canGoLive = useMemo(
    () => {
      const goliveItems = checklist.filter((i) => i.section === "golive");
      return goliveItems.length > 0 && goliveItems.every((i) => i.collected && i.uploaded && i.live);
    },
    [checklist],
  );
  const toggleChecklist = useOnboardingStore((s) => s.toggleChecklist);
  const updateRemarks = useOnboardingStore((s) => s.updateChecklistRemarks);
  const goLive = useProjectStore((s) => s.goLive);
  const updateProject = useProjectStore((s) => s.updateProject);
  const activities = useMemo(
    () => allActivities.filter((a) => a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allActivities, projectId],
  );
  const otherCharges = useMemo(() => allCharges.filter((c) => c.projectId === projectId), [allCharges, projectId]);
  const addOtherCharge = useOnboardingStore((s) => s.addOtherCharge);
  const deleteOtherCharge = useOnboardingStore((s) => s.deleteOtherCharge);

  const [currentStep, setCurrentStep] = useState(project?.currentStep ?? 0);
  const [section, setSection] = useState("project");
  const [goLiveAnim, setGoLiveAnim] = useState(false);

  const sectionItems = useMemo(() => {
    const map: Record<string, typeof checklist> = {};
    for (const item of checklist) {
      (map[item.section] ??= []).push(item);
    }
    return map;
  }, [checklist]);

  if (loading) return <DetailPageSkeleton />;
  if (!project) return <EntityNotFound entity="Project" listPath="/projects" listLabel="Projects" />;

  const projectName = project.name;

  const TABS = [
    { key: "onboarding", label: "Onboarding" },
    { key: "data-migration", label: "Data Migration" },
    { key: "documents", label: "Documents" },
    { key: "customer-app", label: "Customer App" },
    { key: "vendors", label: "Vendors" },
    { key: "labor", label: "Labor" },
    { key: "integrations", label: "Integrations" },
    { key: "training", label: "Training" },
    { key: "go-live", label: "Go Live" },
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
    if (!items.length) return 0;
    const done = items.filter((i) => i.collected && i.uploaded && i.live).length;
    return Math.round((done / items.length) * 100);
  }

  return (
    <PageWrap>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projects</Link>
        </Button>
      </div>

      <PageHeader
        title={project.name}
        subtitle={`${company?.name ?? ""} · ${project.city}`}
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

      <div className="card-soft mb-6 flex flex-wrap gap-1 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate({ search: { tab: t.key } })}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >{t.label}</button>
        ))}
      </div>

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
                    <button onClick={() => { setCurrentStep(i); updateProject(projectId, { currentStep: i }); }} className="group flex flex-col items-center gap-1.5">
                      <motion.div
                        initial={false}
                        animate={{ scale: active ? 1.1 : 1, backgroundColor: done ? "var(--color-success)" : active ? "var(--color-accent)" : "var(--color-muted)" }}
                        className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white", active && "ring-4 ring-accent/25")}
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
            <nav className="card-soft h-fit p-2">
              {ONBOARDING_SECTIONS.map((s) => {
                const active = s.key === section;
                const pct = sectionProgress(s.key);
                const items = sectionItems[s.key] ?? [];
                const done = items.filter((i) => i.collected && i.uploaded && i.live).length;
                return (
                  <button key={s.key} onClick={() => setSection(s.key)} className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", active ? "bg-accent/15 text-accent-foreground" : "hover:bg-muted")}>
                    <div className="flex-1">
                      <div className="font-medium">{s.label}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar value={pct} className="h-1 w-24" />
                        <span className="text-[10px] text-muted-foreground">{done}/{items.length}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={section} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="card-soft p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">{ONBOARDING_SECTIONS.find((s) => s.key === section)?.label}</h3>
                    <Button size="sm" onClick={() => { updateProject(projectId, { currentStep: Math.min(currentStep + 1, 7) }); setCurrentStep((s) => Math.min(s + 1, 7)); toast.success("Progress saved"); }}>
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

                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left">Checklist Item</th>
                          <th className="px-3 py-2 text-center">Collected</th>
                          <th className="px-3 py-2 text-center">Uploaded</th>
                          <th className="px-3 py-2 text-center">Live</th>
                          <th className="px-3 py-2 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sectionItems[section] ?? []).map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-4 py-3 font-medium">{item.label}</td>
                            {(["collected", "uploaded", "live"] as const).map((phase) => (
                              <td key={phase} className="px-3 py-3 text-center">
                                <button
                                  onClick={() => toggleChecklist(item.id, phase)}
                                  className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md border", item[phase] ? "border-success bg-success text-white" : "border-input hover:border-accent")}
                                >
                                  {item[phase] && <Check className="h-3.5 w-3.5" />}
                                </button>
                              </td>
                            ))}
                            <td className="px-3 py-3">
                              <input
                                value={item.remarks}
                                onChange={(e) => updateRemarks(item.id, e.target.value)}
                                placeholder="Add note…"
                                className="h-8 w-full rounded border bg-background px-2 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6">
                    <h4 className="mb-3 text-sm font-semibold">Activity Log</h4>
                    <ol className="relative space-y-4 border-l-2 border-border pl-4">
                      {activities.slice(0, 5).map((a) => (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-accent/20" />
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

      {tab !== "onboarding" && (
        <div className="card-soft p-5">
          <p className="text-sm text-muted-foreground">
            Use the dedicated <Link to={`/${tab}` as "/data-migration"} className="text-accent underline">{tab}</Link> page for full CRUD — data is shared via global stores and scoped to this project where applicable.
          </p>
          <Button className="mt-4" variant="outline" asChild>
            <Link to={`/${tab === "go-live" ? "onboarding" : tab}` as "/data-migration"}>
              Open {TABS.find((t) => t.key === tab)?.label}
            </Link>
          </Button>
        </div>
      )}
    </PageWrap>
  );
}
