import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { ListToolbar, compareNumber, compareText, inDateRange } from "@/components/list-toolbar";
import {
  ProjectFormModal,
  formValuesToProjectPatch,
  type ProjectAdminFormValues,
} from "@/components/project-form-modal";
import { ProjectImportModal } from "@/components/project-import-modal";
import { useCompanyStore, useProjectStore, useOnboardingStore, calcProjectProgress } from "@/stores";
import type { Project } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <ProjectsListPage />;
}

type EnrichedProject = Project & { companyName: string; progress: number };

type CompanyGroup = {
  companyId: string;
  companyName: string;
  city?: string;
  plan?: string;
  startDate?: string;
  projects: EnrichedProject[];
  avgProgress: number;
};

const STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On Hold" },
] as const;

type GroupSort = "company" | "avgProgress" | "projectCount" | "startDate";
type ProjectSort = "name" | "progress" | "status" | "units" | "startDate";

function ProjectsListPage() {
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const companies = useCompanyStore((s) => s.companies);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupSort, setGroupSort] = useState<GroupSort>("company");
  const [projectSort, setProjectSort] = useState<ProjectSort>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const projectTypes = useMemo(() => {
    const set = new Set(projects.map((p) => p.type).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const enrichedAll = useMemo(() => {
    return projects.map((p) => ({
      ...p,
      companyName: companies.find((c) => c.id === p.companyId)?.name ?? "Unknown company",
      progress: calcProjectProgress(p.id, checklistItems),
    }));
  }, [projects, companies, checklistItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enrichedAll.length };
    for (const chip of STATUS_CHIPS) {
      if (chip.id === "all") continue;
      counts[chip.id] = enrichedAll.filter((p) => p.status === chip.id).length;
    }
    return counts;
  }, [enrichedAll]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedAll.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (companyFilter !== "all" && p.companyId !== companyFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (progressFilter === "0" && p.progress !== 0) return false;
      if (progressFilter === "1-49" && !(p.progress >= 1 && p.progress <= 49)) return false;
      if (progressFilter === "50-99" && !(p.progress >= 50 && p.progress <= 99)) return false;
      if (progressFilter === "100" && p.progress !== 100) return false;
      if (!inDateRange(p.startDate, dateFrom, dateTo)) return false;
      if (q) {
        const hay = [p.name, p.companyName, p.city, p.state ?? "", p.type, p.rera]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    enrichedAll,
    search,
    statusFilter,
    companyFilter,
    typeFilter,
    progressFilter,
    dateFrom,
    dateTo,
  ]);

  const groups = useMemo(() => {
    const byCompany = new Map<string, EnrichedProject[]>();
    for (const p of filteredProjects) {
      const list = byCompany.get(p.companyId) ?? [];
      list.push(p);
      byCompany.set(p.companyId, list);
    }

    const result: CompanyGroup[] = [];
    for (const [companyId, companyProjects] of byCompany) {
      const company = companies.find((c) => c.id === companyId);
      const sortedProjects = [...companyProjects].sort((a, b) => {
        switch (projectSort) {
          case "progress":
            return compareNumber(a.progress, b.progress, sortDir);
          case "status":
            return compareText(a.status, b.status, sortDir);
          case "units":
            return compareNumber(a.units, b.units, sortDir);
          case "startDate":
            return compareText(a.startDate || "", b.startDate || "", sortDir);
          case "name":
          default:
            return compareText(a.name, b.name, sortDir);
        }
      });
      const avgProgress =
        sortedProjects.length === 0
          ? 0
          : Math.round(
              sortedProjects.reduce((sum, p) => sum + p.progress, 0) / sortedProjects.length,
            );
      result.push({
        companyId,
        companyName: company?.name ?? companyProjects[0]?.companyName ?? "Unknown company",
        city: company?.city,
        plan: company?.plan,
        startDate: company?.startDate || company?.agreementDate,
        projects: sortedProjects,
        avgProgress,
      });
    }

    result.sort((a, b) => {
      switch (groupSort) {
        case "avgProgress":
          return compareNumber(a.avgProgress, b.avgProgress, sortDir);
        case "projectCount":
          return compareNumber(a.projects.length, b.projects.length, sortDir);
        case "startDate":
          return compareText(a.startDate || "", b.startDate || "", sortDir);
        case "company":
        default:
          return compareText(a.companyName, b.companyName, sortDir);
      }
    });
    return result;
  }, [filteredProjects, companies, groupSort, projectSort, sortDir]);

  useEffect(() => {
    if (expandedInit || groups.length === 0) return;
    setExpanded(
      groups.length <= 3
        ? new Set(groups.map((g) => g.companyId))
        : new Set([groups[0]!.companyId]),
    );
    setExpandedInit(true);
  }, [groups, expandedInit]);

  // Keep matching groups visible when filters change
  useEffect(() => {
    if (!expandedInit) return;
    if (groups.length === 0) return;
    setExpanded((prev) => {
      const stillVisible = [...prev].filter((id) => groups.some((g) => g.companyId === id));
      if (stillVisible.length > 0) return new Set(stillVisible);
      return new Set(groups.slice(0, Math.min(3, groups.length)).map((g) => g.companyId));
    });
  }, [groups, expandedInit]);

  function toggleCompany(companyId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(groups.map((g) => g.companyId)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setModalOpen(true);
  }

  function onSave(data: ProjectAdminFormValues) {
    const patch = formValuesToProjectPatch(data);
    if (editing) {
      updateProject(editing.id, patch);
      toast.success("Project updated");
    } else {
      const project = addProject({ ...patch, status: "not_started", currentStep: 0 });
      toast.success("Project created", {
        action: {
          label: "Open",
          onClick: () =>
            navigate({
              to: "/projects/$projectId",
              params: { projectId: project.id },
              search: { tab: "onboarding" },
            }),
        },
      });
      setExpanded((prev) => new Set(prev).add(project.companyId));
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    const removed = deleteProject(deleting.id);
    if (removed) toast.success("Project deleted");
    setDeleteOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCompanyFilter("all");
    setProgressFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  const activeFilterCount = [
    statusFilter !== "all",
    companyFilter !== "all",
    progressFilter !== "all",
    typeFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    search.trim() !== "",
  ].filter(Boolean).length;

  const allExpanded = groups.length > 0 && expanded.size === groups.length;
  const totalProjects = filteredProjects.length;

  const typeSelect =
    projectTypes.length > 1
      ? [
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "all", label: "All types" },
              ...projectTypes.map((t) => ({ value: t, label: t })),
            ],
          },
        ]
      : [];

  return (
    <PageWrap>
      <PageHeader
        title="Projects"
        subtitle="Projects grouped by client company — expand a company to see its portfolio."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {groups.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="order-2 sm:order-1"
                onClick={allExpanded ? collapseAll : expandAll}
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 sm:order-2"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-4 w-4" /> Import sheet
            </Button>
            <Button className="gap-1.5 bg-primary hover:bg-primary/90 sm:order-3" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Project
            </Button>
          </div>
        }
      />

      {projects.length > 0 && (
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search projects, companies, cities…"
          chips={STATUS_CHIPS.map((c) => ({
            id: c.id,
            label: c.label,
            count: statusCounts[c.id] ?? 0,
          }))}
          activeChip={statusFilter}
          onChipChange={setStatusFilter}
          dateRange={{
            label: "Start date",
            from: dateFrom,
            to: dateTo,
            onFromChange: setDateFrom,
            onToChange: setDateTo,
          }}
          selects={[
            {
              id: "company",
              label: "Company",
              value: companyFilter,
              onChange: setCompanyFilter,
              options: [
                { value: "all", label: "All companies" },
                ...[...companies]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => ({ value: c.id, label: c.name })),
              ],
            },
            {
              id: "progress",
              label: "Progress",
              value: progressFilter,
              onChange: setProgressFilter,
              options: [
                { value: "all", label: "Any progress" },
                { value: "0", label: "Not started (0%)" },
                { value: "1-49", label: "Early (1–49%)" },
                { value: "50-99", label: "Advanced (50–99%)" },
                { value: "100", label: "Complete (100%)" },
              ],
            },
            {
              id: "groupSort",
              label: "Group by",
              value: groupSort,
              onChange: (v) => setGroupSort(v as GroupSort),
              options: [
                { value: "company", label: "Company name" },
                { value: "avgProgress", label: "Avg progress" },
                { value: "projectCount", label: "Project count" },
                { value: "startDate", label: "Company start" },
              ],
            },
            {
              id: "projectSort",
              label: "Projects",
              value: projectSort,
              onChange: (v) => setProjectSort(v as ProjectSort),
              options: [
                { value: "name", label: "Name" },
                { value: "progress", label: "Progress" },
                { value: "status", label: "Status" },
                { value: "units", label: "Units" },
                { value: "startDate", label: "Start date" },
              ],
            },
            ...typeSelect,
          ]}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
          resultCount={totalProjects}
          resultLabel={
            totalProjects === 1
              ? `project in ${groups.length} company`
              : `projects in ${groups.length} compan${groups.length === 1 ? "y" : "ies"}`
          }
          activeFilterCount={activeFilterCount}
          onClear={clearFilters}
        />
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project or import a sheet with Project, ProjectCreatedAt, Company, CompanyCreatedAt."
          actionLabel="+ Add Project"
          onAction={openCreate}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try clearing filters or adjusting your search."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {groups.map((group, gi) => {
              const isOpen = expanded.has(group.companyId);
              return (
                <motion.div
                  key={group.companyId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, delay: Math.min(gi * 0.03, 0.15), ease }}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.04))]"
                >
                  <button
                    type="button"
                    onClick={() => toggleCompany(group.companyId)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:px-5",
                      isOpen ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isOpen ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h3 className="truncate font-semibold tracking-tight">{group.companyName}</h3>
                        {group.plan && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {group.plan}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                        {group.city ? ` · ${group.city}` : ""}
                        {group.startDate ? ` · Started ${formatDate(group.startDate)}` : ""}
                        {" · "}
                        {group.avgProgress}% avg progress
                      </p>
                    </div>
                    <div className="hidden w-28 shrink-0 sm:block">
                      <ProgressBar value={group.avgProgress} className="h-1.5" />
                    </div>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.28, ease }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border bg-muted/20 px-3 py-3 sm:px-4 sm:py-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {group.projects.map((p, pi) => (
                              <motion.div
                                key={p.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  duration: 0.25,
                                  delay: Math.min(pi * 0.04, 0.2),
                                  ease,
                                }}
                                className="rounded-xl border border-border bg-background p-4 transition-shadow hover:shadow-[var(--shadow-elevated)]"
                              >
                                <Link
                                  to="/projects/$projectId"
                                  params={{ projectId: p.id }}
                                  search={{ tab: "onboarding" }}
                                  className="block"
                                >
                                  <div className="mb-2 flex items-start gap-3">
                                    {p.logoUrl ? (
                                      <img
                                        src={p.logoUrl}
                                        alt=""
                                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                                        {p.name.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-semibold leading-snug">{p.name}</h4>
                                      <p className="text-xs text-muted-foreground">
                                        {p.city || "—"}
                                        {p.state ? `, ${p.state}` : ""}
                                      </p>
                                    </div>
                                    <StatusPill status={p.status} />
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    {p.type} · {p.units} units
                                    {p.totalTowers ? ` · ${p.totalTowers} towers` : ""}
                                    {p.startDate ? ` · Started ${formatDate(p.startDate)}` : ""}
                                  </div>
                                  <div className="mt-3">
                                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                                      <span>Onboarding</span>
                                      <span>{p.progress}%</span>
                                    </div>
                                    <ProgressBar value={p.progress} />
                                  </div>
                                </Link>
                                <div className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => openEdit(p)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      setDeleting(p);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        companies={companies}
        editing={editing}
        onSave={onSave}
      />

      <ProjectImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(companyIds) => {
          setExpanded((prev) => {
            const next = new Set(prev);
            for (const id of companyIds) next.add(id);
            return next;
          });
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={deleting ? `Remove ${deleting.name}?` : undefined}
        onConfirm={confirmDelete}
      />
    </PageWrap>
  );
}
