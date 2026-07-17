import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { EntityNotFound } from "@/components/empty-state";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useTicketStore, useCompanyStore, useEmployeeStore, useProjectStore } from "@/stores";
import type { TicketStatus } from "@/types";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/support/$ticketId")({
  component: TicketDetail,
});

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
  projectId: z.string().min(1),
  developerId: z.string(),
  eta: z.string(),
});

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const loading = useDetailLoading();
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.id === ticketId));
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const deleteTicket = useTicketStore((s) => s.deleteTicket);
  const companies = useCompanyStore((s) => s.companies);
  const projects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const company = companies.find((c) => c.id === ticket?.companyId);
  const project = projects.find((p) => p.id === ticket?.projectId);
  const developer = employees.find((e) => e.id === ticket?.developerId);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Bug" as const,
      priority: "Medium" as const,
      status: "New" as const,
      companyId: "",
      projectId: "",
      developerId: "",
      eta: "",
    },
  });

  const watchedCompanyId = form.watch("companyId");
  const companyProjects = useMemo(
    () => projects.filter((p) => p.companyId === watchedCompanyId),
    [projects, watchedCompanyId],
  );

  if (loading) return <DetailPageSkeleton />;
  if (!ticket) return <EntityNotFound entity="Ticket" listPath="/support" listLabel="Support" />;

  function openEdit() {
    form.reset({
      title: ticket!.title,
      description: ticket!.description ?? "",
      type: ticket!.type,
      priority: ticket!.priority,
      status: ticket!.status,
      companyId: ticket!.companyId,
      projectId: ticket!.projectId ?? "",
      developerId: ticket!.developerId,
      eta: ticket!.eta,
    });
    setModalOpen(true);
  }

  function onStatusChange(status: TicketStatus) {
    if (status === ticket!.status) return;
    updateTicket(ticket!.id, { status });
    toast.success(`Status → ${status}`);
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      updateTicket(ticket!.id, { ...data, description: data.description ?? "" });
      toast.success("Ticket updated");
      setModalOpen(false);
    })();
  }

  return (
    <PageWrap>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          onClick={() => void navigate({ to: "/support" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Support
        </Button>
      </div>

      <PageHeader
        title={ticket.title}
        subtitle={ticket.id}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <Pill tone={ticket.type === "Bug" ? "danger" : "info"}>{ticket.type}</Pill>
        <Pill tone={ticket.priority === "Critical" ? "danger" : "warning"}>{ticket.priority}</Pill>
        <Pill tone="muted">{ticket.status}</Pill>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="card-soft space-y-5 p-4 sm:p-5"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {ticket.description?.trim()
                ? ticket.description
                : "No description provided."}
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </div>
            <select
              value={ticket.status}
              onChange={(e) => onStatusChange(e.target.value as TicketStatus)}
              className="h-10 w-full max-w-xs rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              {TICKET_KANBAN_COLUMNS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="card-soft space-y-4 p-4 sm:p-5"
        >
          <Meta
            label="Company"
            value={
              company ? (
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: company.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {company.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Meta
            label="Project"
            value={
              project ? (
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  search={{ tab: "onboarding" }}
                  className="font-medium text-primary hover:underline"
                >
                  {project.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Meta label="Developer" value={developer?.name ?? "—"} />
          <Meta label="Raised on" value={formatDate(ticket.raisedOn)} />
          <Meta label="ETA" value={formatDate(ticket.eta)} />
          <Meta label="Updated" value={formatDate(ticket.updatedAt)} />
        </motion.aside>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Edit Ticket"
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
            rows={4}
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
              const nextProject = projects.find((p) => p.companyId === companyId)?.id ?? "";
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ETA</label>
            <DatePickerField
              modal
              value={form.watch("eta")}
              onChange={(value) => form.setValue("eta", value, { shouldDirty: true, shouldValidate: true })}
              placeholder="Pick ETA"
              yearsBack={1}
              yearsForward={3}
            />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete ticket?"
        onConfirm={() => {
          deleteTicket(ticket.id);
          toast.success("Ticket deleted");
          setDeleteOpen(false);
          void navigate({ to: "/support" });
        }}
      />
    </PageWrap>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
