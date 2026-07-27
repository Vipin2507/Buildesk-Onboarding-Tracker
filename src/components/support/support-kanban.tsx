import { Link } from "@tanstack/react-router";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";

import { Pill } from "@/components/status-pill";
import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import type { Ticket } from "@/types";
import { cn } from "@/lib/utils";

export type EnrichedSupportTicket = Ticket & {
  company: string;
  project: string;
  developer: string;
  owner: string;
};

export const KANBAN_PIPELINE_COLUMNS = [
  "Open",
  "Assigned",
  "In Progress",
  "QA",
  "Ready for Release",
  "Released",
  "Closed",
] as const;

export function SupportKanbanBoard({
  tickets,
  activeId,
}: {
  tickets: EnrichedSupportTicket[];
  activeId: string | null;
}) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      {KANBAN_PIPELINE_COLUMNS.map((col, i) => (
        <motion.div
          key={col}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04, ease: TICKET_EASE }}
        >
          <KanbanColumn title={col} tickets={tickets.filter((t) => t.status === col)} />
        </motion.div>
      ))}
    </div>
  );
}

export function SupportKanbanOverlay({ ticket }: { ticket: EnrichedSupportTicket | undefined }) {
  if (!ticket) return null;
  return <KanbanCard ticket={ticket} />;
}

function KanbanColumn({
  title,
  tickets,
}: {
  title: string;
  tickets: EnrichedSupportTicket[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: title });
  const validDrop = (TICKET_KANBAN_COLUMNS as readonly string[]).includes(title);

  return (
    <div
      ref={validDrop ? setNodeRef : undefined}
      className={cn(
        "w-[min(272px,85vw)] shrink-0 snap-start rounded-xl p-1 transition-colors",
        isOver && validDrop && "bg-primary/10",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-semibold">{title}</div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tickets.length}
        </span>
      </div>
      <div className="min-h-[140px] space-y-2 rounded-xl border border-border/60 bg-muted/30 p-2">
        {tickets.map((c) => (
          <DraggableCard key={c.id} ticket={c} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ ticket }: { ticket: EnrichedSupportTicket }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-50")}
    >
      <KanbanCard ticket={ticket} />
    </div>
  );
}

function KanbanCard({ ticket }: { ticket: EnrichedSupportTicket }) {
  const priorityTone =
    ticket.priority === "Critical"
      ? "danger"
      : ticket.priority === "High"
        ? "warning"
        : ticket.priority === "Medium"
          ? "info"
          : "muted";

  return (
    <div className="card-soft cursor-grab p-3 transition-shadow hover:shadow-md active:cursor-grabbing">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Link
          to="/support/$ticketId"
          params={{ ticketId: ticket.id }}
          className="font-mono text-[10px] text-primary hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ticket.id}
        </Link>
        <Pill tone={priorityTone}>{ticket.priority}</Pill>
      </div>
      <div className="line-clamp-2 text-sm font-medium leading-snug">{ticket.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <Pill tone={ticket.type === "Bug" ? "danger" : "info"}>{ticket.type}</Pill>
        <span>{ticket.developer}</span>
      </div>
    </div>
  );
}
