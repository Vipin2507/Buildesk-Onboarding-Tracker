import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader, PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { useDashboardKpis, useProjectStore, useEmployeeStore } from "@/stores";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingList,
});

function OnboardingList() {
  const kpis = useDashboardKpis();
  const employees = useEmployeeStore((s) => s.employees);
  const projects = useProjectStore((s) => s.projects);
  const inProgress = kpis.companiesWithProgress.filter(
    (c) => c.computedStatus === "in_progress" || (c.progress > 0 && c.progress < 100),
  );

  return (
    <PageWrap>
      <PageHeader title="Onboarding Tracker" subtitle="All active onboardings — click to open project tracker." />

      <div className="space-y-2.5 md:hidden">
        {inProgress.map((c, i) => {
          const p = projects.find((pr) => pr.companyId === c.id);
          const manager = employees.find((e) => e.id === c.onboardingManagerId)?.name ?? "—";
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.24) }}
              className="rounded-xl border border-border bg-card p-3.5"
            >
              <Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium hover:underline">
                {c.name}
              </Link>
              <div className="mt-0.5 text-sm text-muted-foreground">{p?.name ?? "No project"}</div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={c.progress} className="flex-1" />
                <span className="text-xs">{c.progress}%</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{manager}</span>
                {p && (
                  <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-primary" asChild>
                    <Link to="/projects/$projectId" params={{ projectId: p.id }} search={{ tab: "onboarding" }}>
                      Continue <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
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
            {inProgress.map((c) => {
              const p = projects.find((pr) => pr.companyId === c.id);
              return (
                <tr key={c.id} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/companies/$companyId" params={{ companyId: c.id }} className="hover:underline">
                      {c.name}
                    </Link>
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
                      <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
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
