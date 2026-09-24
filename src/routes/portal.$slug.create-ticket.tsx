import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Paperclip, Phone, User, X } from "lucide-react";
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
import { cn, isValidEmail, isValidPortalPhone, usableContactName } from "@/lib/utils";
import { filesToDesignTicketAttachments, isImageAttachment, snapshotFiles } from "@/lib/design-ticket-attachments";
import { DESIGN_TICKET_CATEGORIES } from "@/types/design-ticket";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketAttachment, DesignTicketPriority } from "@/types/design-ticket";
import { DESIGN_TICKET_PRIORITY_LABEL } from "@/types/design-ticket";

const PORTAL_CATEGORY_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: "Dashboard Issue",
    label: "Something is not working",
    hint: "Errors, broken pages, or unexpected behavior",
  },
  {
    value: "Feature Request",
    label: "Request a new feature",
    hint: "New capability or workflow you'd like added",
  },
  {
    value: "Design",
    label: "Design/UI change",
    hint: "Layout, styling, or visual improvement requests",
  },
  {
    value: "Banner Design",
    label: "Creative/banner request",
    hint: "Promotional banners and visual assets",
  },
  {
    value: "Development",
    label: "Integration or technical setup",
    hint: "API, data flow, or implementation support",
  },
  {
    value: "Other",
    label: "General request",
    hint: "Anything that doesn't fit the options above",
  },
].filter((option) => DESIGN_TICKET_CATEGORIES.includes(option.value as never));

export const Route = createFileRoute("/portal/$slug/create-ticket")({
  component: PortalCreateTicket,
});

function PortalCreateTicket() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const createPortalTicket = useDesignTicketStore((s) => s.createPortalTicket);

  const [authorName, setAuthorName] = useState(() => usableContactName(access?.contactName));
  const [authorEmail, setAuthorEmail] = useState(() => access?.contactEmail?.trim() || "");
  const [authorPhone, setAuthorPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(
    PORTAL_CATEGORY_OPTIONS[0]?.value ?? DESIGN_TICKET_CATEGORIES[0],
  );
  const [priority, setPriority] = useState<DesignTicketPriority>("medium");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<DesignTicketAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!access) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || authorName.trim().length < 2) {
      toast.error("Enter your name");
      return;
    }
    if (!isValidEmail(authorEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!isValidPortalPhone(authorPhone)) {
      toast.error("Enter a valid phone number (at least 10 digits)");
      return;
    }
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
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim().toLowerCase(),
        authorPhone: authorPhone.trim(),
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

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    authorName.trim().length >= 2 &&
    isValidEmail(authorEmail) &&
    isValidPortalPhone(authorPhone) &&
    subject.trim().length > 0 &&
    description.trim().length > 0;

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
            title="Create Ticket"
            subtitle="Share your request with details so our team can respond faster."
          />
        </motion.div>

        <motion.form variants={ticketSectionVariants} onSubmit={onSubmit}>
          <DesignTicketFormCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <DesignTicketFormField label="Your name" required>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className={cn(ticketFieldClass, "pl-9")}
                    placeholder="Full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </DesignTicketFormField>
              <DesignTicketFormField label="Phone" required>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={authorPhone}
                    onChange={(e) => setAuthorPhone(e.target.value)}
                    className={cn(ticketFieldClass, "pl-9")}
                    placeholder="10-digit mobile number"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </div>
              </DesignTicketFormField>
            </div>
            <DesignTicketFormField label="Email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  className={cn(ticketFieldClass, "pl-9")}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </DesignTicketFormField>
            <DesignTicketFormField label="Subject" required>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={ticketFieldClass}
                placeholder="Brief summary of your request"
                required
              />
            </DesignTicketFormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <DesignTicketFormField label="Request type">
                <DesignTicketSelect
                  value={category}
                  onChange={setCategory}
                  options={PORTAL_CATEGORY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {PORTAL_CATEGORY_OPTIONS.find((option) => option.value === category)?.hint ??
                    "Choose the option that best matches your request."}
                </p>
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
            <DesignTicketFormField label="Description" required>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={ticketTextareaClass}
                placeholder="What do you need? Include expected outcome, links, and issue steps if relevant."
                required
              />
            </DesignTicketFormField>
            <DesignTicketFormField label="Attachments">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/20 px-4 py-4 text-center transition-colors hover:bg-muted/40">
                <Paperclip className="mb-2 h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {attaching ? "Reading file…" : "Click to attach files"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Images, PDFs, or supporting documents (max 8MB)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  disabled={attaching}
                  onChange={(e) => {
                    const files = snapshotFiles(e.target.files);
                    e.target.value = "";
                    if (!files.length) return;
                    setAttaching(true);
                    void filesToDesignTicketAttachments(files)
                      .then(({ attachments: added, errors }) => {
                        if (errors.length) toast.error(errors.join("; "));
                        if (added.length) {
                          setAttachments((prev) => [...prev, ...added]);
                          toast.success(
                            added.length === 1
                              ? `Attached ${added[0].name}`
                              : `Attached ${added.length} files`,
                          );
                        }
                      })
                      .finally(() => setAttaching(false));
                  }}
                />
              </label>
              {attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="relative overflow-hidden rounded-md border bg-card"
                    >
                      {isImageAttachment(f) && f.url ? (
                        <img src={f.url} alt={f.name} className="h-20 w-28 object-cover" />
                      ) : null}
                      <div className="flex max-w-[9rem] items-center gap-1 px-2 py-1 text-xs">
                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-muted"
                          onClick={() => removeAttachment(i)}
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
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
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting || !canSubmit}>
                {submitting ? "Submitting…" : "Submit Ticket"}
              </Button>
            </div>
          </DesignTicketFormCard>
        </motion.form>
      </motion.div>
    </PortalPageWrap>
  );
}
