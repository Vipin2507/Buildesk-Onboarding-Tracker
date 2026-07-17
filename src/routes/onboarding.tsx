import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  calcProjectProgress,
  useCompanyStore,
  useEmployeeStore,
  useOnboardingStore,
  useProjectProgressStore,
  useProjectStore,
  useUserStore,
} from "@/stores";
import { resolveAssigneeLabel } from "@/lib/managers";
import { PROJECT_PROGRESS_MILESTONES } from "@/types/project";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingList,
});

function OnboardingList() {
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);

  const rows = useMemo(() => {
    return projects
      .map((p) => {
        const company = companies.find((c) => c.id === p.companyId);
        const checklistPct = calcProjectProgress(p.id, checklistItems);
        const row = progressByProject[p.id];
        let manualPct = 0;
        if (row) {
          const na = row.notApplicable ?? {};
          const applicable = PROJECT_PROGRESS_MILESTONES.filter((m) => !na[m.key]);
          manualPct =
            applicable.length === 0
              ? 100
              : Math.round((applicable.filter((m) => row.checks[m.key]).length / applicable.length) * 100);
        }
        const progress = Math.max(checklistPct, manualPct);
        return {
          project: p,
          company,
          progress,
          manager: resolveAssigneeLabel(company?.onboardingManagerId, users, employees),
        };
      })
      .filter((r) => r.project.status !== "completed" && r.progress < 100)
      .sort((a, b) => b.progress - a.progress);
  }, [projects, companies, checklistItems, progressByProject, employees, users]);

  return (
    <PageWrap>
      <PageHeader
        title="Onboarding Tracker"
        subtitle="Active project onboardings — Continue opens Checklist Detail."
      />

      <div className="space-y-2.5 md:hidden">
        {rows.map((r, i) => (
          <motion.div
            key={r.project.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.24) }}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <Link
              to="/companies/$companyId"
              params={{ companyId: r.project.companyId }}
              search={{ tab: "Overview" }}
              className="font-medium hover:underline"
            >
              {r.company?.name ?? "Company"}
            </Link>
            <div className="mt-0.5 text-sm text-muted-foreground">{r.project.name}</div>
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={r.progress} className="flex-1" />
              <span className="text-xs">{r.progress}%</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{r.manager}</span>
              <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-primary" asChild>
                <Link to="/projects/$projectId" params={{ projectId: r.project.id }} search={{ tab: "onboarding" }}>
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        ))}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active onboardings.</p>
        ) : null}
      </div>

      <div className="card-soft hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Company</th>
              <th className="px-4 py-2 text-left font-medium">Project</th>
              <th className="px-4 py-2 text-left font-medium">Progress</th>
              <th className="px-4 py-2 text-left font-medium">Manager</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.project.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: r.project.companyId }}
                    search={{ tab: "Overview" }}
                    className="hover:underline"
                  >
                    {r.company?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.project.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={r.progress} className="w-32" />
                    <span className="text-xs">{r.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">{r.manager}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                    <Link to="/projects/$projectId" params={{ projectId: r.project.id }} search={{ tab: "onboarding" }}>
                      Continue <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No active onboardings.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}
