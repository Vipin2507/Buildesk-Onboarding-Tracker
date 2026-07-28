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
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import type { DesignTicketPriority } from "@/types/design-ticket";
import { DESIGN_TICKET_PRIORITY_LABEL } from "@/types/design-ticket";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

const NONE_PROJECT = "__none__";

export function TicketCreateDialog({
  open,
  onOpenChange,
  companies,
  projects = [],
  actorName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { id: string; name: string }[];
  projects?: { id: string; name: string; companyId: string }[];
  actorName: string;
  onCreated?: (ticketId: string) => void;
}) {
  const createTeamTicket = useDesignTicketStore((s) => s.createTeamTicket);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(DESIGN_TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [saving, setSaving] = useState(false);

  const companyProjects = useMemo(
    () => projects.filter((p) => p.companyId === companyId),
    [projects, companyId],
  );

  useEffect(() => {
    if (!open) return;
    const nextCompanyId = companies[0]?.id ?? "";
    setCompanyId(nextCompanyId);
    setProjectId("");
    setSubject("");
    setDescription("");
    setCategory(DESIGN_TICKET_CATEGORIES[0]);
    setPriority("medium");
  }, [open, companies]);

  function handleCompanyChange(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setProjectId("");
  }

  async function submit() {
    if (!companyId || !subject.trim() || !description.trim()) {
      toast.error("Company, subject, and description are required");
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
      title="Create client ticket"
      submitLabel={saving ? "Creating…" : "Create ticket"}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DesignTicketFormField label="Company">
            <DesignTicketSearchableSelect
              value={companyId}
              placeholder="Search company..."
              emptyLabel="No companies found"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              onChange={handleCompanyChange}
            />
          </DesignTicketFormField>
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
