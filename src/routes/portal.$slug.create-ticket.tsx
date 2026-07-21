import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority } from "@/types/design-ticket";

export const Route = createFileRoute("/portal/$slug/create-ticket")({
  component: PortalCreateTicket,
});

function PortalCreateTicket() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const createTicket = useDesignTicketStore((s) => s.createTicket);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(DESIGN_TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);

  if (!access) return null;
  const portal = access;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    const ticket = createTicket({
      companyId: portal.companyId,
      subject,
      description,
      category,
      priority,
      createdBy: { type: "client", name: portal.contactName },
      attachments,
    });
    toast.success(`Ticket created — ${ticket.ticketNumber}`);
    void navigate({
      to: "/portal/$slug/tickets/$ticketId",
      params: { slug, ticketId: ticket.id },
    });
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
          <Button type="submit" className="w-full sm:w-auto">
            Submit Ticket
          </Button>
        </DesignTicketFormCard>
      </form>
    </PortalPageWrap>
  );
}
