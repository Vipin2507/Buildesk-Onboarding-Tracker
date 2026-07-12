import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useState } from "react";
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
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useTicketStore, useCompanyStore, useEmployeeStore } from "@/stores";
import type { Ticket, TicketStatus } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support")({
  component: Support,
});

const TABS = ["All", "Requirements", "Customizations", "Bugs", "Kanban"] as const;

const ticketSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["Bug", "Customization", "Requirement"]),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  companyId: z.string(),
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
  const employees = useEmployeeStore((s) => s.employees);

  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: "", type: "Bug" as const, priority: "Medium" as const, companyId: companies[0]?.id ?? "", developerId: employees[0]?.id ?? "", eta: "" },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const enriched = tickets.map((t) => ({
    ...t,
    company: companies.find((c) => c.id === t.companyId)?.name ?? "",
    developer: employees.find((e) => e.id === t.developerId)?.name ?? "",
  }));

  const filtered = tab === "All" || tab === "Kanban" ? enriched :
    tab === "Requirements" ? enriched.filter((t) => t.type === "Requirement") :
    tab === "Customizations" ? enriched.filter((t) => t.type === "Customization") :
    enriched.filter((t) => t.type === "Bug");

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
    if (TICKET_KANBAN_COLUMNS.includes(status as typeof TICKET_KANBAN_COLUMNS[number])) {
      moveTicket(String(active.id), status);
      toast.success(`Ticket moved to ${status}`);
    }
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      if (editing) {
        updateTicket(editing.id, data);
        toast.success("Ticket updated");
      } else {
        addTicket({ ...data, status: "New", raisedOn: new Date().toISOString().slice(0, 10) });
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
        actions={<Button className="gap-1.5 bg-primary" onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}><Plus className="h-4 w-4" /> New Ticket</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
          <div key={p} className="card-soft p-3 sm:p-4">
            <Pill tone={p === "Critical" ? "danger" : p === "High" ? "warning" : p === "Medium" ? "info" : "muted"}>{p}</Pill>
            <div className="mt-2 text-xl font-semibold sm:text-2xl"><CountUp to={counts[p]} /></div>
            <div className="text-xs text-muted-foreground">Open bugs</div>
          </div>
        ))}
      </div>

      <div className="card-soft mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{t}</button>
        ))}
      </div>

      {tab !== "Kanban" ? (
        filtered.length === 0 ? (
          <EmptyState title="No tickets yet" description="Create a ticket to track bugs and customizations." actionLabel="+ Create Ticket" onAction={() => setModalOpen(true)} />
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {filtered.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/support/$ticketId" params={{ ticketId: t.id }} className="font-mono text-xs text-primary hover:underline">
                      {t.id}
                    </Link>
                    <Pill tone={t.priority === "Critical" ? "danger" : "warning"}>{t.priority}</Pill>
                  </div>
                  <div className="mt-1 font-medium text-sm">{t.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Pill tone={t.type === "Bug" ? "danger" : "info"}>{t.type}</Pill>
                    <span>{t.status}</span>
                    <span>· {t.developer}</span>
                  </div>
                  <div className="mt-2 flex justify-end gap-1 border-t border-border/60 pt-2">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); form.reset(t); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                      <th className="px-4 py-2 text-left">Developer</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-t hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <Link to="/support/$ticketId" params={{ ticketId: t.id }} className="hover:underline">{t.id}</Link>
                        </td>
                        <td className="px-4 py-2.5"><Pill tone={t.type === "Bug" ? "danger" : "info"}>{t.type}</Pill></td>
                        <td className="px-4 py-2.5 font-medium">{t.title}</td>
                        <td className="px-4 py-2.5"><Pill tone={t.priority === "Critical" ? "danger" : "warning"}>{t.priority}</Pill></td>
                        <td className="px-4 py-2.5">{t.status}</td>
                        <td className="px-4 py-2.5">{t.developer}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(t); form.reset(t); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {TICKET_KANBAN_COLUMNS.map((col) => (
              <KanbanColumn key={col} title={col} tickets={enriched.filter((t) => t.status === col)} />
            ))}
          </div>
          <DragOverlay>
            {activeId ? <KanbanCard ticket={enriched.find((t) => t.id === activeId)!} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Ticket" : "New Ticket"} onSubmit={onSubmit}>
        <div className="grid gap-3">
          <input {...form.register("title")} placeholder="Title" className="h-9 rounded-md border px-3 text-sm" />
          <select {...form.register("type")} className="h-9 rounded-md border px-3 text-sm">
            {["Bug", "Customization", "Requirement"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select {...form.register("priority")} className="h-9 rounded-md border px-3 text-sm">
            {["Critical", "High", "Medium", "Low"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select {...form.register("companyId")} className="h-9 rounded-md border px-3 text-sm">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select {...form.register("developerId")} className="h-9 rounded-md border px-3 text-sm">
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input {...form.register("eta")} type="date" className="h-9 rounded-md border px-3 text-sm" />
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete ticket?" onConfirm={() => { if (editing) { deleteTicket(editing.id); toast.success("Ticket deleted"); } setDeleteOpen(false); }} />
    </PageWrap>
  );
}

function KanbanColumn({ title, tickets }: { title: string; tickets: Array<Ticket & { developer: string }> }) {
  const { setNodeRef, isOver } = useDroppable({ id: title });
  return (
    <div ref={setNodeRef} className={cn("w-[min(260px,85vw)] shrink-0 snap-start rounded-xl p-1", isOver && "bg-primary/10")}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-semibold">{title}</div>
        <span className="text-xs text-muted-foreground">{tickets.length}</span>
      </div>
      <div className="space-y-2 rounded-xl bg-muted/40 p-2 min-h-[120px]">
        {tickets.map((c) => <DraggableCard key={c.id} ticket={c} />)}
      </div>
    </div>
  );
}

function DraggableCard({ ticket }: { ticket: Ticket & { developer: string } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-50")}>
      <KanbanCard ticket={ticket} />
    </div>
  );
}

function KanbanCard({ ticket }: { ticket: Ticket & { developer?: string } }) {
  return (
    <div className="card-soft cursor-grab p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">{ticket.id}</span>
        <Pill tone={ticket.priority === "Critical" ? "danger" : "warning"}>{ticket.priority}</Pill>
      </div>
      <div className="text-sm font-medium">{ticket.title}</div>
      <div className="mt-2 text-xs text-muted-foreground">{ticket.developer}</div>
    </div>
  );
}
