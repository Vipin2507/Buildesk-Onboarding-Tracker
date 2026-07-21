import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrap } from "@/components/page-header";
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
    <PageWrap>
      <h1 className="mb-1 text-xl font-semibold">Create New Ticket</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Describe your design or support request — our team will respond in the thread.
      </p>

      <form onSubmit={onSubmit} className="card-soft mx-auto max-w-2xl space-y-4 p-5">
        <label className="block space-y-1 text-sm">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10 w-full rounded-md border bg-card px-3"
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border bg-card px-3"
          >
            {DESIGN_TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as DesignTicketPriority)}
            className="h-10 w-full rounded-md border bg-card px-3"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded-md border bg-card px-3 py-2"
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          Attachments
          <input
            type="file"
            multiple
            onChange={(e) => {
              setAttachments(Array.from(e.target.files ?? []).map((f) => ({ name: f.name })));
            }}
            className="block w-full text-sm"
          />
        </label>
        <Button type="submit" className="w-full sm:w-auto">
          Submit Ticket
        </Button>
      </form>
    </PageWrap>
  );
}
