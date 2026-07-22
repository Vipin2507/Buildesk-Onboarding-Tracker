import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, ChevronRight, FolderKanban, Search } from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { StatusPill, Pill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/utils";
import type { ChecklistPhaseBucket } from "@/lib/checklist";
import {
  drillDownSubtitle,
  drillDownTitle,
  type ChecklistCompanyGroup,
  type DashboardDrillDownFilter,
} from "@/stores/dashboard-selectors";
import type { Company } from "@/types";
import type { StatusKey } from "@/types/common";

const EASE = [0.22, 1, 0.36, 1] as const;

const PHASE_LABEL: Record<ChecklistPhaseBucket, string> = {
  awaiting_collection: "Collection",
  awaiting_upload: "Upload",
  awaiting_live: "Go-live",
  complete: "Complete",
};

type ResolvedData =
  | { kind: "companies"; companies: (Company & { progress: number; computedStatus: StatusKey })[] }
  | { kind: "checklist"; groups: ChecklistCompanyGroup[] }
  | {
      kind: "support_tickets";
      tickets: { id: string; title: string; status: string; companyId?: string }[];
    }
  | {
      kind: "design_tickets";
      tickets: {
        id: string;
        ticketNumber: string;
        subject: string;
        companyId: string;
        status: string;
      }[];
    }
  | {
      kind: "follow_ups";
      tasks: {
        id: string;
        title: string;
        companyId: string;
        dueDate?: string;
        status: string;
      }[];
      visits: {
        id: string;
        companyId: string;
        purpose: string;
        nextFollowUpDate?: string;
      }[];
    }
  | {
      kind: "visits";
      visits: {
        id: string;
        companyId: string;
        purpose: string;
        scheduledAt: string;
        status: string;
      }[];
    }
  | {
      kind: "renewals";
      companies: {
        id: string;
        name: string;
        plan: string;
        planExpiry: string;
        daysLeft: number;
        urgency: string;
      }[];
    }
  | { kind: "account_health"; companies: Company[] };

type Props = {
  open: boolean;
  filter: DashboardDrillDownFilter | null;
  data: ResolvedData | null;
  onClose: () => void;
  companyNameById: (id: string) => string;
};

function ChecklistHierarchy({
  groups,
  search,
  sectionFilter,
}: {
  groups: ChecklistCompanyGroup[];
  search: string;
  sectionFilter: string;
}) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(() => new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());

  const q = search.trim().toLowerCase();
  const filtered = groups
    .map((company) => ({
      ...company,
      projects: company.projects
        .map((project) => ({
          ...project,
          items: project.items.filter((row) => {
            if (sectionFilter !== "all" && row.item.section !== sectionFilter) return false;
            if (!q) return true;
            return (
              row.item.label.toLowerCase().includes(q) ||
              row.projectName.toLowerCase().includes(q) ||
              row.companyName.toLowerCase().includes(q)
            );
          }),
        }))
        .filter((p) => p.items.length > 0),
    }))
    .filter((c) => c.projects.length > 0);

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No tasks match your filters.</p>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((company, ci) => {
        const companyOpen = expandedCompanies.has(company.companyId) || filtered.length === 1;
        const taskCount = company.projects.reduce((n, p) => n + p.items.length, 0);
        return (
          <motion.div
            key={company.companyId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(ci * 0.03, 0.2), ease: EASE }}
            className="overflow-hidden rounded-xl border"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/60"
              onClick={() => {
                setExpandedCompanies((prev) => {
                  const next = new Set(prev);
                  if (next.has(company.companyId)) next.delete(company.companyId);
                  else next.add(company.companyId);
                  return next;
                });
              }}
            >
              {companyOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{company.companyName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {company.projects.length} proj · {taskCount} tasks
              </span>
            </button>

            <AnimatePresence initial={false}>
              {companyOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="divide-y"
                >
                  {company.projects.map((project) => {
                    const projectKey = `${company.companyId}:${project.projectId}`;
                    const projectOpen =
                      expandedProjects.has(projectKey) || company.projects.length === 1;
                    return (
                      <div key={project.projectId}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 pl-8 text-left text-sm hover:bg-muted/30"
                          onClick={() => {
                            setExpandedProjects((prev) => {
                              const next = new Set(prev);
                              if (next.has(projectKey)) next.delete(projectKey);
                              else next.add(projectKey);
                              return next;
                            });
                          }}
                        >
                          {projectOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {project.projectName}
                          </span>
                          <span className="text-xs text-muted-foreground">{project.items.length}</span>
                        </button>
                        {projectOpen ? (
                          <ul className="pb-1">
                            {project.items.map((row) => (
                              <li key={row.item.id}>
                                <Link
                                  to="/projects/$projectId"
                                  params={{ projectId: row.projectId }}
                                  search={{ tab: "onboarding" }}
                                  className="flex items-center gap-2 px-3 py-2 pl-14 text-sm transition-colors hover:bg-primary/5"
                                >
                                  <span className="min-w-0 flex-1 truncate">{row.item.label}</span>
                                  <Pill tone="muted">{row.item.section}</Pill>
                                  <Pill tone="info">{PHASE_LABEL[row.phase]}</Pill>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DashboardDrillDownSheet({
  open,
  filter,
  data,
  onClose,
  companyNameById,
}: Props) {
  const [search, setSearch] = useState("");

  const sections = useMemo(() => {
    if (data?.kind !== "checklist") return [];
    const set = new Set<string>();
    for (const g of data.groups) {
      for (const p of g.projects) {
        for (const row of p.items) set.add(row.item.section);
      }
    }
    return [...set].sort();
  }, [data]);

  const [sectionFilter, setSectionFilter] = useState("all");

  if (!filter || !data) return null;

  const title = drillDownTitle(filter);
  const subtitle = drillDownSubtitle(filter);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>

        {data.kind === "checklist" ? (
          <div className="flex flex-wrap gap-2 border-b px-5 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, project, task…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
            >
              <option value="all">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {data.kind === "companies" ? (
            <div className="space-y-2">
              {data.companies
                .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                .map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.18), ease: EASE }}
                  >
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: c.id }}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/30 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <ProgressBar value={c.progress} className="max-w-[120px] flex-1" />
                          <span className="text-xs text-muted-foreground">{c.progress}%</span>
                        </div>
                      </div>
                      <StatusPill status={c.computedStatus} />
                    </Link>
                  </motion.div>
                ))}
            </div>
          ) : null}

          {data.kind === "checklist" ? (
            <ChecklistHierarchy groups={data.groups} search={search} sectionFilter={sectionFilter} />
          ) : null}

          {data.kind === "support_tickets" ? (
            <div className="space-y-2">
              {data.tickets.map((t) => (
                <Link
                  key={t.id}
                  to="/support/$ticketId"
                  params={{ ticketId: t.id }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {companyNameById(t.companyId ?? "")} · {t.status}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "design_tickets" ? (
            <div className="space-y-2">
              {data.tickets.map((t) => (
                <Link
                  key={t.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">
                    <span className="text-primary">{t.ticketNumber}</span> — {t.subject}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {companyNameById(t.companyId)} · {t.status}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "follow_ups" ? (
            <div className="space-y-2">
              {data.tasks.map((t) => (
                <Link
                  key={t.id}
                  to="/companies/$companyId"
                  params={{ companyId: t.companyId }}
                  search={{ tab: "Tasks" }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {companyNameById(t.companyId)} · Due {t.dueDate ? formatDate(t.dueDate) : "—"}
                  </div>
                </Link>
              ))}
              {data.visits.map((v) => (
                <Link
                  key={v.id}
                  to="/companies/$companyId"
                  params={{ companyId: v.companyId }}
                  search={{ tab: "Visits" }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">{v.purpose}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Visit follow-up · {companyNameById(v.companyId)} ·{" "}
                    {v.nextFollowUpDate ? formatDate(v.nextFollowUpDate) : "—"}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "visits" ? (
            <div className="space-y-2">
              {data.visits.map((v) => (
                <Link
                  key={v.id}
                  to="/companies/$companyId"
                  params={{ companyId: v.companyId }}
                  search={{ tab: "Visits" }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">{v.purpose}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {companyNameById(v.companyId)} · {formatDate(v.scheduledAt)} · {v.status}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "renewals" ? (
            <div className="space-y-2">
              {data.companies.map((c) => (
                <Link
                  key={c.id}
                  to="/companies/$companyId"
                  params={{ companyId: c.id }}
                  className="block rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <Pill tone="accent">{c.plan}</Pill>
                    <span className="text-muted-foreground">{c.planExpiry}</span>
                    <Pill tone={c.daysLeft < 15 ? "danger" : "warning"}>{c.daysLeft} days</Pill>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "account_health" ? (
            <div className="space-y-2">
              {data.companies.map((c) => (
                <Link
                  key={c.id}
                  to="/companies/$companyId"
                  params={{ companyId: c.id }}
                  className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/30"
                >
                  <span className="font-medium">{c.name}</span>
                  <Pill
                    tone={
                      c.health === "Healthy" ? "success" : c.health === "Moderate" ? "warning" : "danger"
                    }
                  >
                    {c.health}
                  </Pill>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { ResolvedData as DashboardDrillDownData };
