import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Search,
  Rocket,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

const AVATAR_TONES = [
  "bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  "bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  "bg-purple-50 text-purple-600 border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
  "bg-amber-50 text-amber-600 border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  "bg-rose-50 text-rose-600 border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60",
  "bg-sky-50 text-sky-600 border-sky-200/60 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60",
];

function getAvatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "CO";
}

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
      kind: "visit_followups";
      visits: {
        id: string;
        companyId: string;
        purpose: string;
        nextFollowUpDate?: string;
        status: string;
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
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-foreground">No tasks match your filters</p>
        <p className="mt-1 text-xs text-muted-foreground">Try clearing the search or switching section</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {filtered.map((company, ci) => {
        const companyOpen = expandedCompanies.has(company.companyId) || filtered.length === 1;
        const taskCount = company.projects.reduce((n, p) => n + p.items.length, 0);
        return (
          <motion.div
            key={company.companyId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(ci * 0.03, 0.2), ease: EASE }}
            className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
          >
            <button
              type="button"
              className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 bg-muted/30 px-3.5 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
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
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
              </div>
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                {company.companyName}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {company.projects.length} proj · {taskCount} tasks
              </span>
            </button>

            <AnimatePresence initial={false}>
              {companyOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="divide-y divide-border/60"
                >
                  {company.projects.map((project) => {
                    const projectKey = `${company.companyId}:${project.projectId}`;
                    const projectOpen =
                      expandedProjects.has(projectKey) || company.projects.length === 1;
                    return (
                      <div key={project.projectId} className="bg-card">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 pl-8 text-left text-sm hover:bg-muted/30 transition-colors"
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
                          <FolderKanban className="h-3.5 w-3.5 text-primary/70" />
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {project.projectName}
                          </span>
                          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {project.items.length}
                          </span>
                        </button>
                        {projectOpen ? (
                          <ul className="pb-1">
                            {project.items.map((row) => (
                              <li key={row.item.id}>
                                <Link
                                  to="/projects/$projectId"
                                  params={{ projectId: row.projectId }}
                                  search={{ tab: "onboarding" }}
                                  className="group flex flex-col gap-1.5 px-3 py-2 pl-12 text-sm transition-colors hover:bg-primary/5 sm:flex-row sm:items-center sm:gap-2 sm:pl-14"
                                >
                                  <span className="min-w-0 flex-1 sm:truncate text-foreground/90 group-hover:text-primary transition-colors">
                                    {row.item.label}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                                    <Pill tone="muted">{row.item.section}</Pill>
                                    <Pill tone="info">{PHASE_LABEL[row.phase]}</Pill>
                                  </div>
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
  const q = search.trim().toLowerCase();
  const matches = (...parts: Array<string | undefined | null>) =>
    !q || parts.some((part) => part?.toLowerCase().includes(q));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg lg:max-w-xl bg-card border-l border-border/80 shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
          <SheetTitle className="text-lg font-bold tracking-tight text-foreground flex items-center justify-between">
            <span>{title}</span>
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {subtitle || "Click a company to view profile and projects."}
          </SheetDescription>
        </SheetHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, project, task..."
              className="h-9 pl-9 text-xs rounded-xl border-border/70 bg-card focus-visible:ring-primary/30"
              aria-label="Filter records in this list"
            />
          </div>
          {data.kind === "checklist" ? (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {data.kind === "companies" ? (
            <div className="space-y-2">
              {data.companies
                .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                .map((c, i) => {
                  const tone = getAvatarTone(c.name);
                  const initials = getInitials(c.name);

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.18), ease: EASE }}
                    >
                      <Link
                        to="/companies/$companyId"
                        params={{ companyId: c.id }}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Initials Avatar Box */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-bold text-xs ${tone}`}
                          >
                            {initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                              {c.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <ProgressBar value={c.progress} className="max-w-[100px] flex-1 h-1.5" />
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {c.progress}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusPill status={c.computedStatus} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
            </div>
          ) : null}

          {data.kind === "checklist" ? (
            <ChecklistHierarchy
              groups={data.groups}
              search={search}
              sectionFilter={sectionFilter}
            />
          ) : null}

          {data.kind === "support_tickets" ? (
            <div className="space-y-2">
              {data.tickets
                .filter((t) => matches(t.title, t.status, companyNameById(t.companyId ?? "")))
                .map((t) => (
                  <Link
                    key={t.id}
                    to="/support/$ticketId"
                    params={{ ticketId: t.id }}
                    className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {t.title}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {companyNameById(t.companyId ?? "")} · <span className="font-medium text-foreground/80">{t.status}</span>
                    </div>
                  </Link>
                ))}
            </div>
          ) : null}

          {data.kind === "design_tickets" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {data.tickets
                  .filter((t) =>
                    matches(t.ticketNumber, t.subject, t.status, companyNameById(t.companyId)),
                  )
                  .map((t) => (
                    <Link
                      key={t.id}
                      to="/tickets/$ticketId"
                      params={{ ticketId: t.id }}
                      className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                    >
                      <div className="font-semibold text-xs text-foreground">
                        <span className="text-primary font-bold">{t.ticketNumber}</span> —{" "}
                        <span className="group-hover:text-primary transition-colors">{t.subject}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {companyNameById(t.companyId)} · <span className="font-medium text-foreground/80">{t.status}</span>
                      </div>
                    </Link>
                  ))}
              </div>
              <Link
                to="/tickets"
                search={{ filter: "pending" }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View all in Ticket Tracking <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          {data.kind === "follow_ups" ? (
            <div className="space-y-2">
              {data.tasks
                .filter((t) => matches(t.title, t.status, companyNameById(t.companyId)))
                .map((t) => (
                  <Link
                    key={t.id}
                    to="/companies/$companyId"
                    params={{ companyId: t.companyId }}
                    search={{ tab: "Tasks" }}
                    className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {t.title}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {companyNameById(t.companyId)} · Due {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </div>
                  </Link>
                ))}
              {data.visits
                .filter((v) => matches(v.purpose, companyNameById(v.companyId)))
                .map((v) => (
                  <Link
                    key={v.id}
                    to="/companies/$companyId"
                    params={{ companyId: v.companyId }}
                    search={{ tab: "Visits" }}
                    className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {v.purpose}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Visit follow-up · {companyNameById(v.companyId)} ·{" "}
                      {v.nextFollowUpDate ? formatDate(v.nextFollowUpDate) : "—"}
                    </div>
                  </Link>
                ))}
            </div>
          ) : null}

          {data.kind === "visit_followups" ? (
            <div className="space-y-2">
              {data.visits.map((v) => (
                <Link
                  key={v.id}
                  to="/companies/$companyId"
                  params={{ companyId: v.companyId }}
                  search={{ tab: "Visits" }}
                  className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                    {v.purpose}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {companyNameById(v.companyId)} · Follow-up{" "}
                    {v.nextFollowUpDate ? formatDate(v.nextFollowUpDate) : "—"} · {v.status}
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
                  className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                    {v.purpose}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {companyNameById(v.companyId)} · {formatDate(v.scheduledAt)} · {v.status}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {data.kind === "renewals" ? (
            <div className="space-y-2">
              {data.companies
                .filter((c) => matches(c.name, c.plan))
                .map((c) => (
                  <Link
                    key={c.id}
                    to="/companies/$companyId"
                    params={{ companyId: c.id }}
                    className="group block rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {c.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
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
                  className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:bg-muted/30"
                >
                  <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                    {c.name}
                  </span>
                  <Pill
                    tone={
                      c.health === "Healthy"
                        ? "success"
                        : c.health === "Moderate"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {c.health}
                  </Pill>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {/* Bottom Promo Card matching reference screenshot */}
        <div className="p-4 border-t border-border/60 bg-muted/20">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-xs">
                <Rocket className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-foreground">Growing together</h4>
                <p className="text-[11px] text-muted-foreground">Let's build something amazing!</p>
              </div>
              <Link
                to="/companies"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all shrink-0"
              >
                <span>Explore More</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { ResolvedData as DashboardDrillDownData };
