import { useState } from "react";
import { toast } from "sonner";

import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
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

export function TicketCreateDialog({
  open,
  onOpenChange,
  companies,
  actorName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { id: string; name: string }[];
  actorName: string;
  onCreated?: (ticketId: string) => void;
}) {
  const createTeamTicket = useDesignTicketStore((s) => s.createTeamTicket);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(DESIGN_TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [saving, setSaving] = useState(false);

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
      setSubject("");
      setDescription("");
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
      <div className="space-y-4">
        <DesignTicketFormField label="Company">
          <DesignTicketSelect
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
        </DesignTicketFormField>
        <DesignTicketFormField label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={ticketFieldClass}
            placeholder="Brief summary"
          />
        </DesignTicketFormField>
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
            options={(
              ["low", "medium", "high"] as const
            ).map((p) => ({ value: p, label: DESIGN_TICKET_PRIORITY_LABEL[p] }))}
          />
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
