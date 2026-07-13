import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import {
  ListToolbar,
  compareText,
  inDateRange,
} from "@/components/list-toolbar";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useTicketStore, useCompanyStore, useEmployeeStore, useProjectStore } from "@/stores";
import type { Ticket, TicketStatus } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support")({
  component: Support,
});

const TABS = ["All", "Requirements", "Customizations", "Bugs", "Kanban"] as const;

const ticketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(["Bug", "Customization", "Requirement"]),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  status: z.enum([
    "New",
    "Assigned",
    "In Progress",
    "QA",
    "Ready for Release",
    "Released",
    "Closed",
  ]),
  companyId: z.string().min(1),
  projectId: z.string().min(1, "Select a project"),
  developerId: z.string(),
  eta: z.string(),
});

function Support() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <SupportListPage />;
}

function SupportListPage() {
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const deleteTicket = useTicketStore((s) => s.deleteTicket);
  const moveTicket = useTicketStore((s) => s.moveTicket);
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);

  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("raisedOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const defaultCompanyId = companies[0]?.id ?? "";
  const defaultProjectId =
    projects.find((p) => p.companyId === defaultCompanyId)?.id ?? projects[0]?.id ?? "";

  const form = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Bug" as const,
      priority: "Medium" as const,
      status: "New" as const,
      companyId: defaultCompanyId,
      projectId: defaultProjectId,
      developerId: employees[0]?.id ?? "",
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
      companyFilter === "all"
        ? projects
        : projects.filter((p) => p.companyId === companyFilter),
    [projects, companyFilter],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const enriched = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        company: companies.find((c) => c.id === t.companyId)?.name ?? "",
        project: projects.find((p) => p.id === t.projectId)?.name ?? "",
        developer: employees.find((e) => e.id === t.developerId)?.name ?? "",
      })),
    [tickets, companies, projects, employees],
  );

  const tabFiltered = useMemo(() => {
    if (tab === "All" || tab === "Kanban") return enriched;
    if (tab === "Requirements") return enriched.filter((t) => t.type === "Requirement");
    if (tab === "Customizations") return enriched.filter((t) => t.type === "Customization");
    return enriched.filter((t) => t.type === "Bug");
  }, [enriched, tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = tabFiltered.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (companyFilter !== "all" && t.companyId !== companyFilter) return false;
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      if (!inDateRange(t.raisedOn, dateFrom, dateTo)) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.company.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q) ||
        t.developer.toLowerCase().includes(q)
      );
    });

    rows.sort((a, b) => {
      if (sortBy === "priority") {
        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const cmp = order[a.priority] - order[b.priority];
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortBy === "title") return compareText(a.title, b.title, sortDir);
      if (sortBy === "status") return compareText(a.status, b.status, sortDir);
      if (sortBy === "eta") return compareText(a.eta, b.eta, sortDir);
      return compareText(a.raisedOn, b.raisedOn, sortDir);
    });

    return rows;
  }, [
    tabFiltered,
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
    companyFilter,
    projectFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  ]);

  const activeFilterCount = [
    statusFilter !== "all",
    priorityFilter !== "all",
    typeFilter !== "all",
    companyFilter !== "all",
    projectFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const bugs = tickets.filter((t) => t.type === "Bug" && t.status !== "Closed");
  const counts = {
    Critical: bugs.filter((b) => b.priority === "Critical").length,
    High: bugs.filter((b) => b.priority === "High").length,
    Medium: bugs.filter((b) => b.priority === "Medium").length,
    Low: bugs.filter((b) => b.priority === "Low").length,
  };

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const status = over.id as TicketStatus;
    if (TICKET_KANBAN_COLUMNS.includes(status as (typeof TICKET_KANBAN_COLUMNS)[number])) {
      moveTicket(String(active.id), status);
      toast.success(`Ticket moved to ${status}`);
    }
  }

  function openCreate() {
    setEditing(null);
    const companyId = companies[0]?.id ?? "";
    const projectId = projects.find((p) => p.companyId === companyId)?.id ?? "";
    form.reset({
      title: "",
      description: "",
      type: "Bug",
      priority: "Medium",
      status: "New",
      companyId,
      projectId,
      developerId: employees[0]?.id ?? "",
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
      };
      if (editing) {
        updateTicket(editing.id, payload);
        toast.success("Ticket updated");
      } else {
        addTicket({
          ...payload,
          status: payload.status || "New",
          raisedOn: new Date().toISOString().slice(0, 10),
        });
        toast.success("Ticket created");
      }
      setModalOpen(false);
    })();
  }

  return (
    <PageWrap>
      <PageHeader
        title="Support Desk"
        subtitle="Tickets, bugs, customizations and release pipeline."
        actions={
          <Button className="gap-1.5 bg-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
          <div key={p} className="card-soft p-3 sm:p-4">
            <Pill
              tone={
                p === "Critical" ? "danger" : p === "High" ? "warning" : p === "Medium" ? "info" : "muted"
              }
            >
              {p}
            </Pill>
            <div className="mt-2 text-xl font-semibold sm:text-2xl">
              <CountUp to={counts[p]} />
            </div>
            <div className="text-xs text-muted-foreground">Open bugs</div>
          </div>
        ))}
      </div>

      <div className="card-soft mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-medium",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== "Kanban" ? (
        <>
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search tickets, companies, developers…"
            dateRange={{
              label: "Raised on",
              from: dateFrom,
              to: dateTo,
              onFromChange: setDateFrom,
              onToChange: setDateTo,
            }}
            selects={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "All statuses" },
                  ...TICKET_KANBAN_COLUMNS.map((s) => ({ value: s, label: s })),
                ],
              },
              {
                id: "priority",
                label: "Priority",
                value: priorityFilter,
                onChange: setPriorityFilter,
                options: [
                  { value: "all", label: "All priorities" },
                  { value: "Critical", label: "Critical" },
                  { value: "High", label: "High" },
                  { value: "Medium", label: "Medium" },
                  { value: "Low", label: "Low" },
                ],
              },
              {
                id: "type",
                label: "Type",
                value: typeFilter,
                onChange: setTypeFilter,
                options: [
                  { value: "all", label: "All types" },
                  { value: "Bug", label: "Bug" },
                  { value: "Customization", label: "Customization" },
                  { value: "Requirement", label: "Requirement" },
                ],
              },
              {
                id: "company",
                label: "Company",
                value: companyFilter,
                onChange: (value) => {
                  setCompanyFilter(value);
                  setProjectFilter("all");
                },
                options: [
                  { value: "all", label: "All companies" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ],
              },
              {
                id: "project",
                label: "Project",
                value: projectFilter,
                onChange: setProjectFilter,
                options: [
                  { value: "all", label: "All projects" },
                  ...filterProjects.map((p) => ({ value: p.id, label: p.name })),
                ],
              },
            ]}
            sortOptions={[
              { value: "raisedOn", label: "Raised on" },
              { value: "eta", label: "ETA" },
              { value: "priority", label: "Priority" },
              { value: "title", label: "Title" },
              { value: "status", label: "Status" },
            ]}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortByChange={setSortBy}
            onSortDirChange={setSortDir}
            resultCount={filtered.length}
            resultLabel="tickets"
            activeFilterCount={activeFilterCount}
            onClear={() => {
              setSearch("");
              setStatusFilter("all");
              setPriorityFilter("all");
              setTypeFilter("all");
              setCompanyFilter("all");
              setProjectFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="No tickets match"
              description="Try clearing filters or create a new ticket."
              actionLabel="+ Create Ticket"
              onAction={openCreate}
            />
          ) : (
            <>
              <div className="space-y-2.5 md:hidden">
                {filtered.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border bg-card p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/support/$ticketId"
                        params={{ ticketId: t.id }}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {t.id}
                      </Link>
                      <Pill tone={t.priority === "Critical" ? "danger" : "warning"}>{t.priority}</Pill>
                    </div>
                    <div className="mt-1 text-sm font-medium">{t.title}</div>
                    {t.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Pill tone={t.type === "Bug" ? "danger" : "info"}>{t.type}</Pill>
                      <span>{t.status}</span>
                      {t.project ? <span>· {t.project}</span> : null}
                      <span>· {t.developer}</span>
                    </div>
                    <div className="mt-2 flex justify-end gap-1 border-t border-border/60 pt-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(t);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card-soft hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Title</th>
                        <th className="px-4 py-2 text-left">Priority</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Company</th>
                        <th className="px-4 py-2 text-left">Project</th>
                        <th className="px-4 py-2 text-left">Developer</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.id} className="border-t hover:bg-muted/40">
                          <td className="px-4 py-2.5 font-mono text-xs">
                            <Link
                              to="/support/$ticketId"
                              params={{ ticketId: t.id }}
                              className="hover:underline"
                            >
                              {t.id}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <Pill tone={t.type === "Bug" ? "danger" : "info"}>{t.type}</Pill>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{t.title}</div>
                            {t.description ? (
                              <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {t.description}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5">
                            <Pill tone={t.priority === "Critical" ? "danger" : "warning"}>
                              {t.priority}
                            </Pill>
                          </td>
                          <td className="px-4 py-2.5">{t.status}</td>
                          <td className="px-4 py-2.5">{t.company}</td>
                          <td className="px-4 py-2.5">{t.project || "—"}</td>
                          <td className="px-4 py-2.5">{t.developer}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditing(t);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {TICKET_KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col}
                title={col}
                tickets={enriched.filter((t) => t.status === col)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeId ? <KanbanCard ticket={enriched.find((t) => t.id === activeId)!} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Ticket" : "New Ticket"}
        onSubmit={onSubmit}
      >
        <div className="grid gap-3">
          <input
            {...form.register("title")}
            placeholder="Title"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          />
          <textarea
            {...form.register("description")}
            placeholder="Description"
            rows={3}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <select
            {...form.register("type")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            {["Bug", "Customization", "Requirement"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            {...form.register("priority")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            {["Critical", "High", "Medium", "Low"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            {...form.register("status")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            {TICKET_KANBAN_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            {...form.register("companyId")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
            onChange={(e) => {
              const companyId = e.target.value;
              form.setValue("companyId", companyId);
              const nextProject =
                projects.find((p) => p.companyId === companyId)?.id ?? "";
              form.setValue("projectId", nextProject);
            }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            {...form.register("projectId")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            {companyProjects.length === 0 ? (
              <option value="">No projects for this company</option>
            ) : (
              companyProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
          <select
            {...form.register("developerId")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            {...form.register("eta")}
            type="date"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          />
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete ticket?"
        onConfirm={() => {
          if (editing) {
            deleteTicket(editing.id);
            toast.success("Ticket deleted");
          }
          setDeleteOpen(false);
        }}
      />
    </PageWrap>
  );
}

function KanbanColumn({
  title,
  tickets,
}: {
  title: string;
  tickets: Array<Ticket & { developer: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: title });
  return (
    <div
      ref={setNodeRef}
      className={cn("w-[min(260px,85vw)] shrink-0 snap-start rounded-xl p-1", isOver && "bg-primary/10")}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-semibold">{title}</div>
        <span className="text-xs text-muted-foreground">{tickets.length}</span>
      </div>
      <div className="min-h-[120px] space-y-2 rounded-xl bg-muted/40 p-2">
        {tickets.map((c) => (
          <DraggableCard key={c.id} ticket={c} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ ticket }: { ticket: Ticket & { developer: string } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-50")}
    >
      <KanbanCard ticket={ticket} />
    </div>
  );
}

function KanbanCard({ ticket }: { ticket: Ticket & { developer?: string } }) {
  return (
    <div className="card-soft cursor-grab p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <Link
          to="/support/$ticketId"
          params={{ ticketId: ticket.id }}
          className="font-mono text-[10px] text-muted-foreground hover:text-primary hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ticket.id}
        </Link>
        <Pill tone={ticket.priority === "Critical" ? "danger" : "warning"}>{ticket.priority}</Pill>
      </div>
      <div className="text-sm font-medium">{ticket.title}</div>
      <div className="mt-2 text-xs text-muted-foreground">{ticket.developer}</div>
    </div>
  );
}
