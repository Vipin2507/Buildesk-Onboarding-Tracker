import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { useDashboardKpis, useProjectStore, useEmployeeStore, useOnboardingStore } from "@/stores";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingList,
});

function OnboardingList() {
  const kpis = useDashboardKpis();
  const employees = useEmployeeStore((s) => s.employees);
  const projects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const inProgress = kpis.companiesWithProgress.filter((c) => c.computedStatus === "in_progress" || (c.progress > 0 && c.progress < 100));

  return (
    <PageWrap>
      <PageHeader title="Onboarding Tracker" subtitle="All active onboardings — click to open project tracker." />
      <div className="card-soft overflow-hidden">
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
            {inProgress.map((c) => {
              const p = projects.find((pr) => pr.companyId === c.id);
              return (
                <tr key={c.id} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/companies/$companyId" params={{ companyId: c.id }} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={c.progress} className="w-32" />
                      <span className="text-xs">{c.progress}%</span>
                    </div>
                  </td>
                    <td className="px-4 py-3">{employees.find((e) => e.id === c.onboardingManagerId)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {p && (
                      <Button size="sm" variant="ghost" className="gap-1 text-accent-foreground" asChild>
                        <Link to="/projects/$projectId" params={{ projectId: p.id }} search={{ tab: "onboarding" }}>
                          Continue <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}
