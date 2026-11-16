import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, ExternalLink, MessageSquarePlus, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  daysOpenForTicket,
  formatDaysOpen,
  isTicketAging,
  personInitials,
  statusPillClass,
  ticketCategoryLabel,
  ticketCategoryStyle,
  TICKET_AGING_DAYS,
} from "@/components/crm/tickets/crm-tickets-format";
import { CrmTicketSupportDeskAction } from "@/components/crm/tickets/crm-ticket-support-desk-action";
import {
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { resolveAssigneeLabel } from "@/lib/managers";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeeStore, useUserStore } from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicket, DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

const UNASSIGNED = "__unassigned__";

type PreviewTicket = DesignTicket & {
  accountName: string;
  supportManager1: string;
};

export function CrmTicketPreviewSheet({
  ticket,
  open,
  onOpenChange,
  actorName,
}: {
  ticket: PreviewTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorName: string;
}) {
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const addMessage = useDesignTicketStore((s) => s.addMessage);
  const users = useUserStore((s) => s.users);
  const employees = useEmployeeStore((s) => s.employees);

  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DesignTicketStatus>("open");
  const [draftPriority, setDraftPriority] = useState<DesignTicketPriority>("medium");
  const [draftAssignee, setDraftAssignee] = useState("");

  const assigneeOptions = useMemo(() => {
    const fromUsers = users
      .filter((u) => u.active !== false)
      .map((u) => ({ id: u.id, name: u.name }));
    const fromEmployees = employees.map((e) => ({ id: e.id, name: e.name }));
    const seen = new Set(fromUsers.map((u) => u.id));
    const people = [
      ...fromUsers,
      ...fromEmployees.filter((e) => !seen.has(e.id)),
    ].sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: UNASSIGNED, name: "Unassigned" }, ...people];
  }, [users, employees]);

  const liveTicket = useDesignTicketStore((s) =>
    ticket ? s.tickets.find((t) => t.id === ticket.id) : undefined,
  );
  const current =
    ticket && liveTicket
      ? {
          ...ticket,
          ...liveTicket,
          accountName: ticket.accountName,
          supportManager1: ticket.supportManager1,
        }
      : ticket;

  useEffect(() => {
    if (!current || !open) return;
    setDraftStatus(current.status);
    setDraftPriority(current.priority);
    setDraftAssignee(current.assigneeId || UNASSIGNED);
    setNote("");
    setNoteOpen(false);
  }, [current?.id, open, current?.status, current?.priority, current?.assigneeId]);

  const assigneeName = resolveAssigneeLabel(current?.assigneeId, users, employees);
  const daysOpen = current ? daysOpenForTicket(current) : 0;
  const aging = current ? isTicketAging(current, daysOpen) : false;
  const categoryStyle = ticketCategoryStyle(current?.category);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setNote("");
      setNoteOpen(false);
    }
    onOpenChange(next);
  }

  function copyTicketId() {
    if (!current) return;
    void navigator.clipboard.writeText(current.ticketNumber);
    toast.success("Ticket ID copied");
  }

  function saveChanges() {
    if (!current) return;
    let changed = false;
    if (draftStatus !== current.status) {
      updateStatus(current.id, draftStatus, actorName);
      changed = true;
    }
    if (draftPriority !== current.priority) {
      updatePriority(current.id, draftPriority, actorName);
      changed = true;
    }
    const nextAssignee = draftAssignee === UNASSIGNED ? undefined : draftAssignee;
    if (nextAssignee !== (current.assigneeId || undefined)) {
      const name =
        assigneeOptions.find((o) => o.id === (nextAssignee ?? UNASSIGNED))?.name ?? "Unassigned";
      assignTicket(current.id, nextAssignee, name, actorName);
      changed = true;
    }
    if (changed) toast.success("Ticket updated");
    else toast.message("No changes to save");
  }

  function submitNote() {
    if (!current) return;
    const message = note.trim();
    if (!message) {
      toast.error("Enter a note");
      return;
    }
    addMessage(current.id, {
      authorType: "team",
      authorName: actorName,
      message,
    });
    toast.success("Note added");
    setNote("");
    setNoteOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28, ease: TICKET_EASE }}
              className="flex h-full flex-col"
            >
              <SheetHeader className="space-y-3 border-b border-border/70 bg-gradient-to-br from-primary/[0.06] to-transparent px-5 pb-4 pt-5 text-left">
                <div className="flex items-start justify-between gap-3 pr-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <SheetTitle className="text-sm font-semibold text-primary">
                        {current.ticketNumber}
                      </SheetTitle>
                      <button
                        type="button"
                        onClick={copyTicketId}
                        className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Copy ticket ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <SheetDescription className="mt-1 line-clamp-2 text-sm text-foreground">
                      {current.subject}
                    </SheetDescription>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                      statusPillClass(draftStatus),
                    )}
                  >
                    {DESIGN_TICKET_STATUS_LABEL[draftStatus]}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="truncate font-medium">
                      <Link
                        to="/crm/accounts/$accountId"
                        params={{ accountId: current.companyId }}
                        className="text-primary hover:underline"
                      >
                        {current.accountName}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Raised</dt>
                    <dd className="font-medium">{formatDate(current.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Days open</dt>
                    <dd
                      className={cn(
                        "font-semibold tabular-nums",
                        aging ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                      )}
                    >
                      {formatDaysOpen(daysOpen)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assignee</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                        {personInitials(assigneeName === "—" ? "?" : assigneeName)}
                      </span>
                      <span className="truncate">{assigneeName}</span>
                    </dd>
                  </div>
                </dl>

                <div
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                    aging
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {aging
                    ? `Aging — open ≥ ${TICKET_AGING_DAYS} days`
                    : `On track — under ${TICKET_AGING_DAYS}-day target`}
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <section>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Description
                  </h4>
                  <p className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-foreground/90">
                    {current.description?.trim() || "No description provided."}
                  </p>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[11px]">
                    <span className="font-medium text-muted-foreground">Category</span>
                    <div
                      className={cn(
                        "flex h-9 items-center rounded-md border border-border/70 px-2.5 text-xs font-medium",
                        categoryStyle.bg,
                      )}
                    >
                      {ticketCategoryLabel(current.category)}
                    </div>
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="font-medium text-muted-foreground">Priority</span>
                    <DesignTicketSelect
                      compact
                      value={draftPriority}
                      onChange={(v) => setDraftPriority(v as DesignTicketPriority)}
                      options={DESIGN_TICKET_PRIORITIES.map((p) => ({
                        value: p,
                        label: DESIGN_TICKET_PRIORITY_LABEL[p],
                      }))}
                    />
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="font-medium text-muted-foreground">Assignee</span>
                    <DesignTicketSelect
                      compact
                      value={draftAssignee}
                      onChange={setDraftAssignee}
                      options={assigneeOptions.map((o) => ({
                        value: o.id,
                        label: o.name,
                      }))}
                    />
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="font-medium text-muted-foreground">Status</span>
                    <DesignTicketSelect
                      compact
                      value={draftStatus}
                      onChange={(v) => setDraftStatus(v as DesignTicketStatus)}
                      options={DESIGN_TICKET_STATUSES.map((s) => ({
                        value: s,
                        label: DESIGN_TICKET_STATUS_LABEL[s],
                      }))}
                    />
                  </label>
                </section>

                <AnimatePresence initial={false}>
                  {noteOpen ? (
                    <motion.section
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: TICKET_EASE }}
                      className="overflow-hidden"
                    >
                      <label className="block space-y-1.5 text-[11px]">
                        <span className="font-medium text-muted-foreground">Add note</span>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          placeholder="Update the client or leave an internal note…"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                        />
                      </label>
                      <div className="mt-2 flex gap-2">
                        <Button type="button" size="sm" className="h-8 text-xs" onClick={submitNote}>
                          Post note
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => {
                            setNoteOpen(false);
                            setNote("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-card px-5 py-3">
                <Button type="button" size="sm" className="h-8 text-xs" onClick={saveChanges}>
                  Update Ticket
                </Button>
                <CrmTicketSupportDeskAction ticket={current} actorName={actorName} preferCrm />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setNoteOpen(true)}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Add Note
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    const support = current.supportManager1?.trim();
                    if (!support) {
                      toast.message("No Support 1 on this account");
                      return;
                    }
                    const match = assigneeOptions.find(
                      (o) => o.name.toLowerCase() === support.toLowerCase(),
                    );
                    if (!match?.id) {
                      toast.message(`Could not match Support 1 (${support})`);
                      return;
                    }
                    setDraftAssignee(match.id);
                    toast.success(`Ready to assign ${match.name}`);
                  }}
                >
                  <UserRound className="h-3.5 w-3.5" />
                  Reassign
                </Button>
                <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 gap-1.5 text-xs" asChild>
                  <Link to="/crm/tickets/$ticketId" params={{ ticketId: current.id }}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Full view
                  </Link>
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
