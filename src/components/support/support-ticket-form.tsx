import type { UseFormReturn } from "react-hook-form";

import {
  DesignTicketFormField,
  ticketFieldClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { DatePickerField } from "@/components/date-picker-field";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { SUPPORT_PRIORITIES, SUPPORT_TYPES } from "@/lib/support-tracking";

export type SupportTicketFormValues = {
  title: string;
  description?: string;
  type: (typeof SUPPORT_TYPES)[number];
  priority: (typeof SUPPORT_PRIORITIES)[number];
  status: (typeof TICKET_KANBAN_COLUMNS)[number];
  companyId: string;
  projectId: string;
  developerId: string;
  assignedUserId?: string;
  backendAssigned: boolean;
  eta: string;
};

type Props = {
  form: UseFormReturn<SupportTicketFormValues>;
  companies: { id: string; name: string }[];
  companyProjects: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onCompanyChange: (companyId: string) => void;
};

export function SupportTicketForm({
  form,
  companies,
  companyProjects,
  employees,
  users,
  onCompanyChange,
}: Props) {
  return (
    <div className="grid gap-4">
      <DesignTicketFormField label="Title">
        <input
          {...form.register("title")}
          placeholder="Brief summary"
          className={ticketFieldClass}
        />
      </DesignTicketFormField>
      <DesignTicketFormField label="Description">
        <textarea
          {...form.register("description")}
          placeholder="Details, steps to reproduce, acceptance criteria…"
          rows={4}
          className={ticketTextareaClass}
        />
      </DesignTicketFormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <DesignTicketFormField label="Type">
          <DesignTicketSelect
            value={form.watch("type")}
            onChange={(v) => form.setValue("type", v as SupportTicketFormValues["type"])}
            options={SUPPORT_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </DesignTicketFormField>
        <DesignTicketFormField label="Priority">
          <DesignTicketSelect
            value={form.watch("priority")}
            onChange={(v) => form.setValue("priority", v as SupportTicketFormValues["priority"])}
            options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
        </DesignTicketFormField>
      </div>
      <DesignTicketFormField label="Status">
        <DesignTicketSelect
          value={form.watch("status")}
          onChange={(v) => form.setValue("status", v as SupportTicketFormValues["status"])}
          options={TICKET_KANBAN_COLUMNS.map((s) => ({ value: s, label: s }))}
        />
      </DesignTicketFormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <DesignTicketFormField label="Company">
          <DesignTicketSelect
            value={form.watch("companyId")}
            onChange={(v) => {
              form.setValue("companyId", v);
              onCompanyChange(v);
            }}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
        </DesignTicketFormField>
        <DesignTicketFormField label="Project">
          <DesignTicketSelect
            value={form.watch("projectId")}
            onChange={(v) => form.setValue("projectId", v)}
            options={
              companyProjects.length
                ? companyProjects.map((p) => ({ value: p.id, label: p.name }))
                : [{ value: "", label: "No projects for company" }]
            }
          />
        </DesignTicketFormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DesignTicketFormField label="Developer">
          <DesignTicketSelect
            value={form.watch("developerId")}
            onChange={(v) => form.setValue("developerId", v)}
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
          />
        </DesignTicketFormField>
        <DesignTicketFormField label="Internal owner">
          <DesignTicketSelect
            value={form.watch("assignedUserId") || "__unassigned__"}
            onChange={(v) =>
              form.setValue("assignedUserId", v === "__unassigned__" ? "" : v)
            }
            options={[
              { value: "__unassigned__", label: "Unassigned" },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
        </DesignTicketFormField>
      </div>
      <label className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
        <input type="checkbox" {...form.register("backendAssigned")} className="rounded" />
        Forwarded / assigned to Backend
      </label>
      <DesignTicketFormField label="ETA">
        <DatePickerField
          modal
          value={form.watch("eta")}
          onChange={(value) => form.setValue("eta", value, { shouldDirty: true })}
          placeholder="Pick ETA"
          yearsBack={1}
          yearsForward={3}
        />
      </DesignTicketFormField>
    </div>
  );
}
