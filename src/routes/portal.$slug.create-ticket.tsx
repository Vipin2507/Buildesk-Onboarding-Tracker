import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketFieldClass,
  ticketPageVariants,
  ticketSectionVariants,
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

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((f) => f.name !== name));
  }

  return (
    <PortalPageWrap>
      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={ticketSectionVariants}>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => void navigate({ to: "/portal/$slug/dashboard", params: { slug } })}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </motion.div>

        <motion.div variants={ticketSectionVariants}>
          <DesignTicketPageHeader
            title="Create New Ticket"
            subtitle="Describe your request — our team will respond in the ticket thread."
          />
        </motion.div>

        <motion.form variants={ticketSectionVariants} onSubmit={onSubmit}>
          <DesignTicketFormCard>
            <DesignTicketFormField label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={ticketFieldClass}
                placeholder="Brief summary of your request"
                required
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
                rows={6}
                className={ticketTextareaClass}
                placeholder="Include as much detail as possible — steps to reproduce, screenshots, etc."
                required
              />
            </DesignTicketFormField>
            <DesignTicketFormField label="Attachments">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/20 px-4 py-6 text-center transition-colors hover:bg-muted/40">
                <Paperclip className="mb-2 h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Click to attach files</span>
                <span className="mt-1 text-xs text-muted-foreground">Images, PDFs, or documents</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const added = Array.from(e.target.files ?? []).map((f) => ({ name: f.name }));
                    if (added.length) setAttachments((prev) => [...prev, ...added]);
                    e.target.value = "";
                  }}
                />
              </label>
              {attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((f) => (
                    <span
                      key={f.name}
                      className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      {f.name}
                      <button
                        type="button"
                        className="ml-0.5 rounded p-0.5 hover:bg-muted"
                        onClick={() => removeAttachment(f.name)}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </DesignTicketFormField>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => void navigate({ to: "/portal/$slug/tickets", params: { slug } })}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Ticket"}
              </Button>
            </div>
          </DesignTicketFormCard>
        </motion.form>
      </motion.div>
    </PortalPageWrap>
  );
}
