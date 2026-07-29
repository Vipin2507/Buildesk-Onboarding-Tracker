import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

import { PageWrap } from "@/components/page-header";
import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { DataTable } from "@/components/data-table";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingList,
});

type ProgressBand = "all" | "early" | "mid" | "near";

type OnboardingRow = {
  id: string;
  companyId: string;
  companyName: string;
  projectName: string;
  progress: number;
  manager: string;
};

function bandFor(progress: number): Exclude<ProgressBand, "all"> {
  if (progress >= 80) return "near";
  if (progress >= 40) return "mid";
  return "early";
}

function OnboardingList() {
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);

  const [band, setBand] = useState<ProgressBand>("all");

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
          id: p.id,
          companyId: p.companyId,
          companyName: company?.name ?? "—",
          projectName: p.name,
          progress,
          manager: resolveAssigneeLabel(company?.onboardingManagerId, users, employees),
          status: p.status,
        };
      })
      .filter((r) => r.status !== "completed" && r.progress < 100)
      .sort((a, b) => b.progress - a.progress);
  }, [projects, companies, checklistItems, progressByProject, employees, users]);

  const filtered = useMemo(() => {
    if (band === "all") return rows;
    return rows.filter((r) => bandFor(r.progress) === band);
  }, [rows, band]);

  const stats = useMemo(() => {
    const avg =
      rows.length === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / rows.length);
    return {
      active: rows.length,
      avg,
      early: rows.filter((r) => r.progress < 40).length,
      mid: rows.filter((r) => r.progress >= 40 && r.progress < 80).length,
      near: rows.filter((r) => r.progress >= 80).length,
    };
  }, [rows]);

  const kpiCards = [
    {
      id: "active",
      label: "Active",
      value: stats.active,
      icon: Clock,
      active: band === "all",
      onClick: () => setBand("all"),
    },
    {
      id: "avg",
      label: "Avg %",
      value: stats.avg,
      icon: TrendingUp,
      tone: "text-primary",
    },
    {
      id: "early",
      label: "Early (<40%)",
      value: stats.early,
      icon: AlertTriangle,
      tone: "text-warning-foreground",
      active: band === "early",
      onClick: () => setBand("early"),
    },
    {
      id: "near",
      label: "Near done",
      value: stats.near,
      icon: CheckCircle2,
      tone: "text-success",
      active: band === "near",
      onClick: () => setBand("near"),
    },
  ];

  const statusTabs = [
    { id: "all", label: `All (${stats.active})` },
    { id: "early", label: `Early (${stats.early})` },
    { id: "mid", label: `Mid (${stats.mid})` },
    { id: "near", label: `Near (${stats.near})` },
  ];

  const columns: {
    key: string;
    header: string;
    sortable?: boolean;
    render: (r: OnboardingRow) => ReactNode;
  }[] = [
    {
      key: "companyName",
      header: "Company",
      sortable: true,
      render: (r) => (
        <Link
          to="/companies/$companyId"
          params={{ companyId: r.companyId }}
          search={{ tab: "Overview" }}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.companyName}
        </Link>
      ),
    },
    {
      key: "projectName",
      header: "Project",
      sortable: true,
      render: (r) => <span className="text-muted-foreground">{r.projectName}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      render: (r) => (
        <div className="flex min-w-[140px] items-center gap-2">
          <ProgressBar value={r.progress} className="h-1.5 w-28" />
          <span
            className={cn(
              "w-8 text-right text-xs tabular-nums font-medium",
              r.progress >= 80 ? "text-success" : r.progress < 40 ? "text-warning-foreground" : "",
            )}
          >
            {r.progress}%
          </span>
        </div>
      ),
    },
    {
      key: "manager",
      header: "Manager",
      render: (r) => <span className="text-muted-foreground">{r.manager}</span>,
    },
  ];

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Onboarding Tracker"
        subtitle="Active project onboardings — Continue opens Checklist Detail."
      />

      <div className="mb-3 min-w-0">
        <DesignTicketKpiGrid items={kpiCards} columns={4} size="compact" />
      </div>

      <DesignTicketTabNav
        compact
        tabs={statusTabs}
        activeId={band}
        onChange={(id) => setBand(id as ProgressBand)}
      />

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.2), ease: TICKET_EASE }}
            className="card-soft p-3"
          >
            <Link
              to="/companies/$companyId"
              params={{ companyId: r.companyId }}
              search={{ tab: "Overview" }}
              className="text-sm font-medium hover:underline"
            >
              {r.companyName}
            </Link>
            <div className="mt-0.5 text-xs text-muted-foreground">{r.projectName}</div>
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={r.progress} className="h-1.5 flex-1" />
              <span className="text-[10px] tabular-nums font-medium">{r.progress}%</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{r.manager}</span>
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary" asChild>
                <Link to="/projects/$projectId" params={{ projectId: r.id }} search={{ tab: "onboarding" }}>
                  Continue <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No active onboardings.</p>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DesignTicketSection title={`${filtered.length} active`} delay={0.04} compact>
          <DataTable
            data={filtered}
            columns={columns}
            getRowId={(r) => r.id}
            searchKeys={["companyName", "projectName", "manager"]}
            emptyState={<p className="py-8 text-center text-xs text-muted-foreground">No active onboardings.</p>}
            actions={(r) => (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary" asChild>
                <Link to="/projects/$projectId" params={{ projectId: r.id }} search={{ tab: "onboarding" }}>
                  Continue <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          />
        </DesignTicketSection>
      </div>
    </PageWrap>
  );
}
