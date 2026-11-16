import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketSearchableSelect,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFormField,
  ticketFieldClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityFormModal } from "@/components/entity-form-modal";
import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { cn } from "@/lib/utils";
import { useEmployeeStore, useUserStore } from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import type { DesignTicketPriority } from "@/types/design-ticket";
import { DESIGN_TICKET_PRIORITY_LABEL } from "@/types/design-ticket";

const NONE_PROJECT = "__none__";
const UNASSIGNED = "__unassigned__";

export type TicketCreateCompanyOption = {
  id: string;
  name: string;
  /** CRM account Support 1 display name (matched to users). */
  supportManager1?: string;
  /** ERP company Support 1 user/employee id. */
  supportManager1Id?: string;
};

export function TicketCreateDialog({
  open,
  onOpenChange,
  companies,
  projects = [],
  actorName,
  onCreated,
  title = "Create client ticket",
  companyLabel = "Company",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: TicketCreateCompanyOption[];
  projects?: { id: string; name: string; companyId: string }[];
  actorName: string;
  onCreated?: (ticketId: string) => void;
  title?: string;
  companyLabel?: string;
}) {
  const createTeamTicket = useDesignTicketStore((s) => s.createTeamTicket);
  const users = useUserStore((s) => s.users);
  const employees = useEmployeeStore((s) => s.employees);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(DESIGN_TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED);
  const [assigneeTouched, setAssigneeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const companyProjects = useMemo(
    () => projects.filter((p) => p.companyId === companyId),
    [projects, companyId],
  );

  const assigneeOptions = useMemo(() => {
    const fromUsers = users
      .filter((u) => u.active !== false)
      .map((u) => ({ id: u.id, name: u.name }));
    const fromEmployees = employees.map((e) => ({ id: e.id, name: e.name }));
    const seen = new Set(fromUsers.map((u) => u.id));
    return [
      ...fromUsers,
      ...fromEmployees.filter((e) => !seen.has(e.id)),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, employees]);

  function defaultAssigneeForCompany(nextCompanyId: string) {
    const company = companies.find((c) => c.id === nextCompanyId);
    if (!company) return UNASSIGNED;
    if (company.supportManager1Id) {
      const byId = assigneeOptions.find((o) => o.id === company.supportManager1Id);
      if (byId) return byId.id;
    }
    if (company.supportManager1?.trim()) {
      const byName = assigneeOptions.find((o) =>
        crmSalesManagerNamesMatch(company.supportManager1, o.name),
      );
      if (byName) return byName.id;
    }
    return UNASSIGNED;
  }

  useEffect(() => {
    if (!open) return;
    const nextCompanyId = companies[0]?.id ?? "";
    setCompanyId(nextCompanyId);
    setProjectId("");
    setSubject("");
    setDescription("");
    setCategory(DESIGN_TICKET_CATEGORIES[0]);
    setPriority("medium");
    setAssigneeTouched(false);
    setAssigneeId(defaultAssigneeForCompany(nextCompanyId));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset once when dialog opens

  useEffect(() => {
    if (!open || !companyId || assigneeTouched) return;
    // Apply Support 1 once assignee options are available (users may hydrate after open).
    const next = defaultAssigneeForCompany(companyId);
    if (next !== UNASSIGNED) setAssigneeId(next);
  }, [open, companyId, assigneeOptions, companies, assigneeTouched]);

  function handleCompanyChange(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setProjectId("");
    setAssigneeTouched(false);
    setAssigneeId(defaultAssigneeForCompany(nextCompanyId));
  }

  async function submit() {
    if (!companyId || !subject.trim() || !description.trim()) {
      toast.error(`${companyLabel}, subject, and description are required`);
      return;
    }
    setSaving(true);
    try {
      const ticket = await createTeamTicket(
        {
          companyId,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          assigneeId: assigneeId === UNASSIGNED ? "" : assigneeId,
        },
        actorName,
      );
      toast.success(`Ticket ${ticket.ticketNumber} created`);
      onOpenChange(false);
      onCreated?.(ticket.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel={saving ? "Creating…" : "Create ticket"}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-4">
        <div className={cn("grid gap-4", projects.length > 0 ? "sm:grid-cols-2" : "")}>
          <DesignTicketFormField label={companyLabel}>
            <DesignTicketSearchableSelect
              value={companyId}
              placeholder={`Search ${companyLabel.toLowerCase()}...`}
              emptyLabel={`No ${companyLabel.toLowerCase()}s found`}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              onChange={handleCompanyChange}
            />
          </DesignTicketFormField>
          {projects.length > 0 ? (
            <DesignTicketFormField label="Project (optional)">
              <DesignTicketSearchableSelect
                value={projectId || NONE_PROJECT}
                placeholder="Search project..."
                emptyLabel={
                  companyProjects.length ? "No projects found" : "No projects for this company"
                }
                options={[
                  { value: NONE_PROJECT, label: "No specific project" },
                  ...companyProjects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                onChange={(v) => setProjectId(v === NONE_PROJECT ? "" : v)}
                disabled={!companyId}
              />
            </DesignTicketFormField>
          ) : null}
        </div>

        <DesignTicketFormField label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={ticketFieldClass}
            placeholder="Brief summary"
          />
        </DesignTicketFormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <DesignTicketFormField label="Category">
            <DesignTicketSelect
              value={category}
              onChange={setCategory}
              options={DESIGN_TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </DesignTicketFormField>
          <DesignTicketFormField label="Priority">
            <DesignTicketSelect
              value={priority}
              onChange={(v) => setPriority(v as DesignTicketPriority)}
              options={(["low", "medium", "high"] as const).map((p) => ({
                value: p,
                label: DESIGN_TICKET_PRIORITY_LABEL[p],
              }))}
            />
          </DesignTicketFormField>
        </div>

        <DesignTicketFormField label="Assignee">
          <DesignTicketSelect
            value={assigneeId}
            onChange={(v) => {
              setAssigneeTouched(true);
              setAssigneeId(v);
            }}
            options={[
              { value: UNASSIGNED, label: "Unassigned" },
              ...assigneeOptions.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Defaults to Support 1 for the selected {companyLabel.toLowerCase()} when available.
          </p>
        </DesignTicketFormField>

        <DesignTicketFormField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={ticketTextareaClass}
            placeholder="Details for the client and internal team"
          />
        </DesignTicketFormField>
      </div>
    </EntityFormModal>
  );
}
