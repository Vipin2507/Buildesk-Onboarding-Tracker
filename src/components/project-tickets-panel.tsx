import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useTicketStore, useEmployeeStore, useProjectStore } from "@/stores";
import type { Ticket } from "@/types";

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
  developerId: z.string(),
  eta: z.string(),
});

type Props = {
  projectId: string;
  companyId: string;
};

export function ProjectTicketsPanel({ projectId, companyId }: Props) {
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const deleteTicket = useTicketStore((s) => s.deleteTicket);
  const employees = useEmployeeStore((s) => s.employees);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);

  const projectTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.projectId === projectId)
        .map((t) => ({
          ...t,
          developer: employees.find((e) => e.id === t.developerId)?.name ?? "",
        })),
    [tickets, projectId, employees],
  );

  const openCount = projectTickets.filter((t) => t.status !== "Closed").length;

  const form = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Bug" as const,
      priority: "Medium" as const,
      status: "New" as const,
      developerId: employees[0]?.id ?? "",
      eta: "",
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      title: "",
      description: "",
      type: "Bug",
      priority: "Medium",
      status: "New",
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
        companyId,
        projectId,
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">Project tickets</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {openCount} open · {projectTickets.length} total
            {project ? ` for ${project.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/support">Open Support Desk</Link>
          </Button>
          <Button className="gap-1.5 bg-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>
      </div>

      {projectTickets.length === 0 ? (
        <EmptyState
          title="No tickets for this project"
          description="Raise a bug, customization, or requirement tied to this project."
          actionLabel="+ Create Ticket"
          onAction={openCreate}
        />
      ) : (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
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
                {projectTickets.map((t) => (
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
                    <td className="px-4 py-2.5 font-medium">{t.title}</td>
                    <td className="px-4 py-2.5">
                      <Pill tone={t.priority === "Critical" ? "danger" : "warning"}>
                        {t.priority}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5">{t.status}</td>
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
    </div>
  );
}
