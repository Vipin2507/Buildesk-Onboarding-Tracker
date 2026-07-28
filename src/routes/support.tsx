import { createFileRoute, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  Bug,
  Clock,
  Kanban,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketInfoBanner,
  DesignTicketFilterBar,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import {
  SupportKanbanBoard,
  SupportKanbanOverlay,
  type EnrichedSupportTicket,
} from "@/components/support/support-kanban";
import {
  SupportTicketForm,
  type SupportTicketFormValues,
} from "@/components/support/support-ticket-form";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { usePermissions } from "@/hooks/use-permissions";
import { inDateRange } from "@/components/list-toolbar";
import { isTicketOpen } from "@/lib/tickets";
import {
  matchesSupportKpiFilter,
  SUPPORT_PRIORITIES,
  SUPPORT_TYPES,
  supportKpiFilterLabel,
  type SupportKpiFilter,
} from "@/lib/support-tracking";
import { formatDate } from "@/lib/utils";
import {
  useTicketStore,
  useCompanyStore,
  useEmployeeStore,
  useProjectStore,
  useActiveUsers,
  useCurrentUser,
} from "@/stores";
import type { Ticket, TicketPriority, TicketStatus } from "@/types";
import { cn } from "@/lib/utils";

const UNASSIGNED = "__unassigned__";
const TYPE_TABS = ["list", "requirements", "customizations", "bugs", "kanban"] as const;
type TypeTab = (typeof TYPE_TABS)[number];

const searchSchema = z.object({
  filter: z.enum(["all", "open", "in-progress", "critical", "resolved"]).optional(),
});

const ticketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(SUPPORT_TYPES),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  status: z.enum(TICKET_KANBAN_COLUMNS),
  companyId: z.string().min(1),
  projectId: z.string().min(1, "Select a project"),
  developerId: z.string(),
  assignedUserId: z.string().optional(),
  backendAssigned: z.boolean(),
  eta: z.string(),
});

type BulkAction = "developer" | "owner" | "status" | "priority" | null;

export const Route = createFileRoute("/support")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Support,
});

function Support() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <SupportListPage />;
}

function SupportListPage() {
  const navigate = useNavigate({ from: "/support" });
  const { filter: kpiFilter = "all" } = Route.useSearch();
  const tableRef = useRef<HTMLDivElement>(null);

  const currentUser = useCurrentUser();
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const deleteTicket = useTicketStore((s) => s.deleteTicket);
  const moveTicket = useTicketStore((s) => s.moveTicket);
  const bulkDeleteTickets = useTicketStore((s) => s.bulkDeleteTickets);
  const bulkAssignDeveloper = useTicketStore((s) => s.bulkAssignDeveloper);
  const bulkAssignOwner = useTicketStore((s) => s.bulkAssignOwner);
  const bulkUpdateStatus = useTicketStore((s) => s.bulkUpdateStatus);
  const bulkUpdatePriority = useTicketStore((s) => s.bulkUpdatePriority);
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useActiveUsers();
  const { can, isAdmin } = usePermissions();
  const canManageTickets = isAdmin || can("manageTickets");

  const [typeTab, setTypeTab] = useState<TypeTab>("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ mode: "single" | "bulk"; id?: string } | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkDeveloperId, setBulkDeveloperId] = useState("");
  const [bulkOwnerId, setBulkOwnerId] = useState(UNASSIGNED);
  const [bulkStatus, setBulkStatus] = useState<TicketStatus>("In Progress");
  const [bulkPriority, setBulkPriority] = useState<TicketPriority>("Medium");

  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applied, setApplied] = useState({
    company: "all",
    status: "all",
    priority: "all",
    type: "all",
    project: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const defaultCompanyId = companies[0]?.id ?? "";
  const defaultProjectId =
    projects.find((p) => p.companyId === defaultCompanyId)?.id ?? projects[0]?.id ?? "";

  const form = useForm<SupportTicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Bug",
      priority: "Medium",
      status: "Open",
      companyId: defaultCompanyId,
      projectId: defaultProjectId,
      developerId: employees[0]?.id ?? "",
      assignedUserId: "",
      backendAssigned: false,
      eta: "",
    },
  });

  const watchedCompanyId = form.watch("companyId");
  const companyProjects = useMemo(
    () => projects.filter((p) => p.companyId === watchedCompanyId),
    [projects, watchedCompanyId],
  );

  const filterProjects = useMemo(
    () =>
      applied.company === "all"
        ? projects
        : projects.filter((p) => p.companyId === applied.company),
    [projects, applied.company],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const enriched: EnrichedSupportTicket[] = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        company: companies.find((c) => c.id === t.companyId)?.name ?? "—",
        project: projects.find((p) => p.id === t.projectId)?.name ?? "—",
        developer: employees.find((e) => e.id === t.developerId)?.name ?? "—",
        owner: users.find((u) => u.id === t.assignedUserId)?.name ?? "Unassigned",
      })),
    [tickets, companies, projects, employees, users],
  );

  const stats = useMemo(() => {
    const open = enriched.filter((t) => isTicketOpen(t));
    return {
      total: enriched.length,
      open: open.length,
      inProgress: open.filter((t) =>
        matchesSupportKpiFilter(t, "in-progress"),
      ).length,
      critical: open.filter((t) => t.priority === "Critical").length,
      resolved: enriched.filter((t) => matchesSupportKpiFilter(t, "resolved")).length,
    };
  }, [enriched]);

  const setKpiFilter = useCallback(
    (filter: SupportKpiFilter) => {
      void navigate({ search: { filter }, replace: true });
      window.setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    [navigate],
  );

  const typeTabFiltered = useMemo(() => {
    if (typeTab === "list" || typeTab === "kanban") return enriched;
    if (typeTab === "requirements") return enriched.filter((t) => t.type === "Requirement");
    if (typeTab === "customizations") return enriched.filter((t) => t.type === "Customization");
    return enriched.filter((t) => t.type === "Bug");
  }, [enriched, typeTab]);

  const filtered = useMemo(() => {
    return typeTabFiltered.filter((t) => {
      if (!matchesSupportKpiFilter(t, kpiFilter)) return false;
      if (applied.company !== "all" && t.companyId !== applied.company) return false;
      if (applied.status !== "all" && t.status !== applied.status) return false;
      if (applied.priority !== "all" && t.priority !== applied.priority) return false;
      if (applied.type !== "all" && t.type !== applied.type) return false;
      if (applied.project !== "all" && t.projectId !== applied.project) return false;
      if (!inDateRange(t.raisedOn, applied.dateFrom, applied.dateTo)) return false;
      return true;
    });
  }, [typeTabFiltered, kpiFilter, applied]);

  const selectedCount = selectedIds.size;
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const ownerOptions = users.map((u) => ({ id: u.id, name: u.name }));

  function applyFilters() {
    setApplied({
      company: companyFilter,
      status: statusFilter,
      priority: priorityFilter,
      type: typeFilter,
      project: projectFilter,
      dateFrom,
      dateTo,
    });
  }

  function clearFilters() {
    setCompanyFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setProjectFilter("all");
    setDateFrom("");
    setDateTo("");
    setApplied({
      company: "all",
      status: "all",
      priority: "all",
      type: "all",
      project: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  const activeFilterCount = useMemo(
    () =>
      [
        applied.company !== "all",
        applied.status !== "all",
        applied.priority !== "all",
        applied.type !== "all",
        applied.project !== "all",
        applied.dateFrom,
        applied.dateTo,
      ].filter(Boolean).length,
    [applied],
  );

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllSelection(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !canManageTickets) return;
    const status = String(over.id) as TicketStatus;
    if ((TICKET_KANBAN_COLUMNS as readonly string[]).includes(status)) {
      moveTicket(String(active.id), status);
      toast.success(`Ticket moved to ${status}`);
    }
  }

  function openCreate() {
    if (!canManageTickets) {
      toast.error("You do not have permission to manage tickets");
      return;
    }
    setEditing(null);
    const companyId = companies[0]?.id ?? "";
    const projectId = projects.find((p) => p.companyId === companyId)?.id ?? "";
    form.reset({
      title: "",
      description: "",
      type: "Bug",
      priority: "Medium",
      status: "Open",
      companyId,
      projectId,
      developerId: employees[0]?.id ?? "",
      assignedUserId: "",
      backendAssigned: false,
      eta: "",
    });
    setModalOpen(true);
  }

  function openEdit(t: Ticket) {
    setEditing(t);
    form.reset({
      title: t.title,
      description: t.description ?? "",
      type: t.type,
      priority: t.priority,
      status: t.status,
      companyId: t.companyId,
      projectId: t.projectId ?? "",
      developerId: t.developerId,
      assignedUserId: t.assignedUserId ?? "",
      backendAssigned: t.backendAssigned,
      eta: t.eta,
    });
    setModalOpen(true);
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      const payload = {
        ...data,
        description: data.description ?? "",
        projectId: data.projectId,
        assignedUserId: data.assignedUserId || undefined,
      };
      if (editing) {
        updateTicket(editing.id, payload);
        toast.success("Ticket updated");
      } else {
        addTicket({
          ...payload,
          status: payload.status || "Open",
          raisedOn: new Date().toISOString().slice(0, 10),
        });
        toast.success("Ticket created");
      }
      setModalOpen(false);
    })();
  }

  function confirmDelete() {
    if (deleteConfirm?.mode === "bulk") {
      bulkDeleteTickets(selectedList);
      toast.success(`Deleted ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
    } else if (deleteConfirm?.id) {
      deleteTicket(deleteConfirm.id);
      toast.success("Ticket deleted");
    }
    setDeleteConfirm(null);
  }

  function runBulkDeveloper() {
    if (!bulkDeveloperId) {
      toast.error("Select a developer");
      return;
    }
    bulkAssignDeveloper(selectedList, bulkDeveloperId);
    toast.success(`Assigned developer on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function runBulkOwner() {
    bulkAssignOwner(
      selectedList,
      bulkOwnerId === UNASSIGNED ? undefined : bulkOwnerId,
    );
    toast.success(`Updated owner on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function runBulkStatus() {
    bulkUpdateStatus(selectedList, bulkStatus);
    toast.success(`Updated status on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function runBulkPriority() {
    bulkUpdatePriority(selectedList, bulkPriority);
    toast.success(`Updated priority on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  const kpiCards = [
    {
      id: "all",
      label: "Total",
      value: stats.total,
      icon: Archive,
      onClick: () => setKpiFilter("all"),
      active: kpiFilter === "all",
    },
    {
      id: "open",
      label: "Open",
      value: stats.open,
      tone: "text-info",
      icon: Clock,
      onClick: () => setKpiFilter("open"),
      active: kpiFilter === "open",
    },
    {
      id: "in-progress",
      label: "In Progress",
      value: stats.inProgress,
      tone: "text-warning-foreground",
      icon: Kanban,
      onClick: () => setKpiFilter("in-progress"),
      active: kpiFilter === "in-progress",
    },
    {
      id: "critical",
      label: "Critical",
      value: stats.critical,
      tone: "text-destructive",
      icon: AlertTriangle,
      onClick: () => setKpiFilter("critical"),
      active: kpiFilter === "critical",
    },
    {
      id: "resolved",
      label: "Resolved",
      value: stats.resolved,
      tone: "text-success",
      icon: List,
      onClick: () => setKpiFilter("resolved"),
      active: kpiFilter === "resolved",
    },
  ];

  const TYPE_TAB_CONFIG: { id: TypeTab; label: string; icon: typeof List }[] = [
    { id: "list", label: "All", icon: List },
    { id: "requirements", label: "Requirements", icon: List },
    { id: "customizations", label: "Customizations", icon: List },
    { id: "bugs", label: "Bugs", icon: Bug },
    { id: "kanban", label: "Kanban", icon: Kanban },
  ];

  const priorityTone = (p: TicketPriority) =>
    p === "Critical" ? "danger" : p === "High" ? "warning" : p === "Medium" ? "info" : "muted";

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Support Desk"
        subtitle="Engineering tickets — bugs, customizations, requirements, and release pipeline."
        actions={
          canManageTickets ? (
            <Button size="sm" className="gap-1 bg-primary" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              New Ticket
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3">
        <DesignTicketKpiGrid items={kpiCards} columns={5} size="compact" />
      </div>

      <DesignTicketTabNav
        compact
        tabs={TYPE_TAB_CONFIG}
        activeId={typeTab}
        onChange={(id) => setTypeTab(id as TypeTab)}
      />

      {typeTab === "kanban" ? (
        <motion.div
          variants={ticketSectionVariants}
          initial="hidden"
          animate="show"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={onDragEnd}
          >
            <SupportKanbanBoard
              tickets={typeTabFiltered.filter((t) => matchesSupportKpiFilter(t, kpiFilter))}
              activeId={activeId}
            />
            <DragOverlay>
              <SupportKanbanOverlay ticket={enriched.find((t) => t.id === activeId)} />
            </DragOverlay>
          </DndContext>
        </motion.div>
      ) : (
        <>
          <DesignTicketFilterBar
            compact
            className="xl:grid-cols-6"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            onApply={applyFilters}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "ticket" : "tickets"}
          >
            <DesignTicketFilterField label="Company" compact>
              <DesignTicketSelect
                compact
                value={companyFilter}
                onChange={(v) => {
                  setCompanyFilter(v);
                  if (v !== companyFilter) setProjectFilter("all");
                }}
                options={[
                  { value: "all", label: "All companies" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  ...TICKET_KANBAN_COLUMNS.map((s) => ({ value: s, label: s })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Priority" compact>
              <DesignTicketSelect
                compact
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  { value: "all", label: "All priorities" },
                  ...SUPPORT_PRIORITIES.map((p) => ({ value: p, label: p })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Type" compact>
              <DesignTicketSelect
                compact
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "All types" },
                  ...SUPPORT_TYPES.map((t) => ({ value: t, label: t })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              label="Raised from"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From"
            />
            <DesignTicketDateField
              compact
              label="Raised to"
              value={dateTo}
              onChange={setDateTo}
              placeholder="To"
            />
            <DesignTicketFilterField label="Project" className="sm:col-span-2 lg:col-span-3" compact>
              <DesignTicketSelect
                compact
                value={projectFilter}
                onChange={setProjectFilter}
                options={[
                  { value: "all", label: "All projects" },
                  ...filterProjects.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </DesignTicketFilterField>
          </DesignTicketFilterBar>

          <div ref={tableRef}>
            <DesignTicketSection title={supportKpiFilterLabel(kpiFilter)} delay={0.06} compact>
              {selectedCount > 0 && canManageTickets ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium">{selectedCount} selected</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setBulkAction("developer")}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign dev
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkAction("owner")}>
                    Assign owner
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkAction("status")}>
                    Change status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkAction("priority")}>
                    Change priority
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleteConfirm({ mode: "bulk" })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </motion.div>
              ) : null}

              {filtered.length === 0 ? (
                <EmptyState
                  title="No tickets match"
                  description="Try another KPI card, clear filters, or create a new ticket."
                  actionLabel={canManageTickets ? "New Ticket" : undefined}
                  onAction={canManageTickets ? openCreate : undefined}
                />
              ) : (
                <div className="card-soft overflow-hidden p-0.5">
                  <DataTable
                    data={filtered}
                    getRowId={(r) => r.id}
                    searchKeys={["id", "title", "company", "project", "developer", "owner", "description"]}
                    pageSize={15}
                    density="compact"
                    selection={
                      canManageTickets
                        ? {
                            selectedIds,
                            onToggle: toggleSelection,
                            onToggleAll: toggleAllSelection,
                          }
                        : undefined
                    }
                    onRowClick={(row) =>
                      void navigate({ to: "/support/$ticketId", params: { ticketId: row.id } })
                    }
                    columns={[
                      {
                        key: "id",
                        header: "ID",
                        render: (r) => <span className="font-medium text-primary">{r.id}</span>,
                        sortable: true,
                      },
                      {
                        key: "type",
                        header: "Type",
                        render: (r) => (
                          <Pill tone={r.type === "Bug" ? "danger" : "info"} className="text-[10px] px-1.5 py-px">
                            {r.type}
                          </Pill>
                        ),
                      },
                      {
                        key: "title",
                        header: "Title",
                        render: (r) => (
                          <span className="line-clamp-1 max-w-[180px] font-medium" title={r.title}>
                            {r.title}
                          </span>
                        ),
                        sortable: true,
                      },
                      {
                        key: "priority",
                        header: "Pri",
                        render: (r) => (
                          <Pill tone={priorityTone(r.priority)} className="text-[10px] px-1.5 py-px">
                            {r.priority}
                          </Pill>
                        ),
                      },
                      { key: "status", header: "Status", render: (r) => r.status, sortable: true },
                      {
                        key: "company",
                        header: "Company",
                        render: (r) => <span className="line-clamp-1 max-w-[100px]">{r.company}</span>,
                        sortable: true,
                      },
                      {
                        key: "project",
                        header: "Project",
                        render: (r) => <span className="line-clamp-1 max-w-[100px]">{r.project}</span>,
                      },
                      { key: "developer", header: "Dev", render: (r) => r.developer },
                      { key: "owner", header: "Owner", render: (r) => r.owner },
                      {
                        key: "raisedOn",
                        header: "Raised",
                        render: (r) => formatDate(r.raisedOn),
                        sortable: true,
                      },
                      { key: "eta", header: "ETA", render: (r) => (r.eta ? formatDate(r.eta) : "—") },
                    ]}
                    actions={
                      canManageTickets
                        ? (row) => (
                            <SupportRowActions
                              employees={employees}
                              owners={ownerOptions}
                              currentUserId={currentUser?.id}
                              onAssignDeveloper={(id) => {
                                updateTicket(row.id, { developerId: id });
                                toast.success("Developer assigned");
                              }}
                              onAssignOwner={(id) => {
                                updateTicket(row.id, { assignedUserId: id });
                                toast.success("Owner assigned");
                              }}
                              onStatus={(status) => {
                                moveTicket(row.id, status);
                                toast.success(`Status → ${status}`);
                              }}
                              onPriority={(priority) => {
                                updateTicket(row.id, { priority });
                                toast.success("Priority updated");
                              }}
                              onEdit={() => openEdit(row)}
                              onDelete={() => setDeleteConfirm({ mode: "single", id: row.id })}
                            />
                          )
                        : undefined
                    }
                  />
                </div>
              )}
            </DesignTicketSection>
          </div>

          <div className="mt-3">
            <DesignTicketInfoBanner compact>
              Drag tickets on the Kanban board to move them through the release pipeline. Bulk actions
              apply to selected rows in the list view.
            </DesignTicketInfoBanner>
          </div>
        </>
      )}

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Ticket" : "New Ticket"}
        onSubmit={onSubmit}
        submitLabel={editing ? "Save changes" : "Create ticket"}
      >
        <SupportTicketForm
          form={form}
          companies={companies}
          companyProjects={companyProjects}
          employees={employees}
          users={users}
          onCompanyChange={(companyId) => {
            const nextProject = projects.find((p) => p.companyId === companyId)?.id ?? "";
            form.setValue("projectId", nextProject);
          }}
        />
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteConfirm != null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.mode === "bulk" ? `Delete ${selectedCount} tickets?` : "Delete ticket?"}
        description="This permanently removes the ticket and its activity history."
        onConfirm={confirmDelete}
      />

      <Dialog open={bulkAction === "developer"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign developer ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Developer">
            <DesignTicketSelect
              value={bulkDeveloperId}
              onChange={setBulkDeveloperId}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={runBulkDeveloper}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAction === "owner"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign owner ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Internal owner">
            <DesignTicketSelect
              value={bulkOwnerId}
              onChange={setBulkOwnerId}
              options={[
                { value: UNASSIGNED, label: "Unassigned" },
                ...users.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={runBulkOwner}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAction === "status"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Status">
            <DesignTicketSelect
              value={bulkStatus}
              onChange={(v) => setBulkStatus(v as TicketStatus)}
              options={TICKET_KANBAN_COLUMNS.map((s) => ({ value: s, label: s }))}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={runBulkStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAction === "priority"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change priority ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Priority">
            <DesignTicketSelect
              value={bulkPriority}
              onChange={(v) => setBulkPriority(v as TicketPriority)}
              options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={runBulkPriority}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrap>
  );
}

function SupportRowActions({
  employees,
  owners,
  currentUserId,
  onAssignDeveloper,
  onAssignOwner,
  onStatus,
  onPriority,
  onEdit,
  onDelete,
}: {
  employees: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  currentUserId?: string;
  onAssignDeveloper: (developerId: string) => void;
  onAssignOwner: (ownerId: string | undefined) => void;
  onStatus: (status: TicketStatus) => void;
  onPriority: (priority: TicketPriority) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>Edit ticket</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Assignment
        </DropdownMenuLabel>
        {currentUserId && owners.some((o) => o.id === currentUserId) ? (
          <DropdownMenuItem onClick={() => onAssignOwner(currentUserId)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign to me
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assign developer…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            {employees.map((e) => (
              <DropdownMenuItem key={e.id} onClick={() => onAssignDeveloper(e.id)}>
                {e.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assign owner…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => onAssignOwner(undefined)}>Unassigned</DropdownMenuItem>
            <DropdownMenuSeparator />
            {owners.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => onAssignOwner(o.id)}>
                {o.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Ticket
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TICKET_KANBAN_COLUMNS.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change priority</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {SUPPORT_PRIORITIES.map((p) => (
              <DropdownMenuItem key={p} onClick={() => onPriority(p)}>
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
