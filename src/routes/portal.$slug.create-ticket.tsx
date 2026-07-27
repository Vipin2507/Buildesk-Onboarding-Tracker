import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketFieldClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { Button } from "@/components/ui/button";
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority } from "@/types/design-ticket";
import { DESIGN_TICKET_PRIORITY_LABEL } from "@/types/design-ticket";

export const Route = createFileRoute("/portal/$slug/create-ticket")({
  component: PortalCreateTicket,
});

function PortalCreateTicket() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const createPortalTicket = useDesignTicketStore((s) => s.createPortalTicket);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(DESIGN_TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!access) return null;
  const portal = access;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await createPortalTicket(slug, {
        subject,
        description,
        category,
        priority,
        authorName: portal.contactName,
        attachments,
      });
      toast.success(`Ticket created — ${ticket.ticketNumber}`);
      void navigate({
        to: "/portal/$slug/tickets/$ticketId",
        params: { slug, ticketId: ticket.id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalPageWrap>
      <DesignTicketPageHeader
        title="Create New Ticket"
        subtitle="Describe your design or support request — our team will respond in the thread."
      />

      <form onSubmit={onSubmit}>
        <DesignTicketFormCard>
          <DesignTicketFormField label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={ticketFieldClass}
              required
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
              rows={6}
              className={ticketTextareaClass}
              required
            />
          </DesignTicketFormField>
          <DesignTicketFormField label="Attachments">
            <input
              type="file"
              multiple
              onChange={(e) => {
                setAttachments(Array.from(e.target.files ?? []).map((f) => ({ name: f.name })));
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
            />
          </DesignTicketFormField>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Ticket"}
          </Button>
        </DesignTicketFormCard>
      </form>
    </PortalPageWrap>
  );
}
