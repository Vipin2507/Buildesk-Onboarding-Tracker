import { useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketFormField,
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import type { DesignTicketPriority } from "@/types/design-ticket";
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
      <div className="space-y-3">
        <DesignTicketFormField label="Company">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={ticketSelectClass}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={ticketSelectClass}>
            {DESIGN_TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </DesignTicketFormField>
        <DesignTicketFormField label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as DesignTicketPriority)}
            className={ticketSelectClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
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
