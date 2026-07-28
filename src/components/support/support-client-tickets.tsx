import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { DesignTicketPriorityChip, DesignTicketStatusPill } from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketFilterBar,
  DesignTicketSection,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { DesignTicketDateField, DesignTicketFilterField, DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import {
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import { inDateRange } from "@/components/list-toolbar";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";
import { useCompanyStore, useDesignTicketStore, useEmployeeStore, useActiveUsers, useCurrentUser, useDesignTicketHighlights } from "@/stores";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";

type ClientAppliedFilters = {
  company: string;
  status: "all" | DesignTicketStatus;
  priority: "all" | DesignTicketPriority;
  dateFrom: string;
  dateTo: string;
};

function TicketRowActions({
  assigneeOptions,
  currentUserId,
  onAssign,
  onStatus,
  onPriority,
  onDelete,
}: {
  assigneeOptions: { id: string; name: string }[];
  currentUserId?: string;
  onAssign: (assigneeId: string | undefined, assigneeName: string) => void;
  onStatus: (status: DesignTicketStatus) => void;
  onPriority: (priority: DesignTicketPriority) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Assignment
        </DropdownMenuLabel>
        {currentUserId ? (
          <DropdownMenuItem
            onClick={() => {
              const me = assigneeOptions.find((a) => a.id === currentUserId);
              if (me) onAssign(me.id, me.name);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign to me
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assign to…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => onAssign(undefined, "Unassigned")}>Unassigned</DropdownMenuItem>
            <DropdownMenuSeparator />
            {assigneeOptions.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => onAssign(a.id, a.name)}>
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Ticket
        </DropdownMenuLabel>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DESIGN_TICKET_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                {DESIGN_TICKET_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change priority</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DESIGN_TICKET_PRIORITIES.map((p) => (
              <DropdownMenuItem key={p} onClick={() => onPriority(p)}>
                {DESIGN_TICKET_PRIORITY_LABEL[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SupportClientTicketsSection() {
  const navigate = useNavigate();
  const tickets = useDesignTicketStore((s) => s.tickets);
  const deleteTicket = useDesignTicketStore((s) => s.deleteTicket);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const highlights = useDesignTicketHighlights();

  const companies = useCompanyStore((s) => s.companies);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useActiveUsers();

  const currentUser = useCurrentUser();
  const actorName = currentUser?.name ?? "Team";

  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DesignTicketStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | DesignTicketPriority>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [applied, setApplied] = useState<ClientAppliedFilters>({
    company: "all",
    status: "all",
    priority: "all",
    dateFrom: "",
    dateTo: "",
  });

  const assigneeOptions = useMemo(
    () => [
      ...users.map((u) => ({ id: u.id, name: u.name })),
      ...employees.map((e) => ({ id: e.id, name: e.name })),
    ],
    [users, employees],
  );

  const enriched = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        companyName: companies.find((c) => c.id === t.companyId)?.name ?? "—",
        assigneeName:
          users.find((u) => u.id === t.assigneeId)?.name ??
          employees.find((e) => e.id === t.assigneeId)?.name ??
          "Unassigned",
        isNew: highlights.includes(t.id),
      })),
    [tickets, companies, users, employees, highlights],
  );

  const filtered = useMemo(() => {
    return enriched.filter((t) => {
      if (applied.company !== "all" && t.companyId !== applied.company) return false;
      if (applied.status !== "all" && t.status !== applied.status) return false;
      if (applied.priority !== "all" && t.priority !== applied.priority) return false;
      if (!inDateRange(t.createdAt, applied.dateFrom, applied.dateTo)) return false;
      return true;
    });
  }, [enriched, applied]);

  function applyFilters() {
    setApplied({ company: companyFilter, status: statusFilter, priority: priorityFilter, dateFrom, dateTo });
  }

  function clearFilters() {
    setCompanyFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDateFrom("");
    setDateTo("");
    setApplied({ company: "all", status: "all", priority: "all", dateFrom: "", dateTo: "" });
  }

  const activeFilterCount = useMemo(
    () =>
      [
        applied.company !== "all",
        applied.status !== "all",
        applied.priority !== "all",
        applied.dateFrom,
        applied.dateTo,
      ].filter(Boolean).length,
    [applied],
  );

  const hasTickets = filtered.length > 0;

  return (
    <motion.div
      variants={ticketSectionVariants}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      <DesignTicketSection title="Client Tickets (Ticket Tracking)" compact>
        <div className="space-y-3">
          <DesignTicketFilterBar
            compact
            className="xl:grid-cols-5"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            onApply={applyFilters}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "ticket" : "tickets"}
          >
            <DesignTicketFilterField label="Company" compact>
              <DesignTicketSelect
                compact
                value={companyFilter}
                onChange={setCompanyFilter}
                options={[
                  { value: "all", label: "All Companies" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as DesignTicketStatus)}
                options={[
                  { value: "all", label: "All statuses" },
                  ...DESIGN_TICKET_STATUSES.map((s) => ({
                    value: s,
                    label: DESIGN_TICKET_STATUS_LABEL[s],
                  })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Priority" compact>
              <DesignTicketSelect
                compact
                value={priorityFilter}
                onChange={(v) => setPriorityFilter(v as DesignTicketPriority)}
                options={[
                  { value: "all", label: "All priorities" },
                  ...DESIGN_TICKET_PRIORITIES.map((p) => ({
                    value: p,
                    label: DESIGN_TICKET_PRIORITY_LABEL[p],
                  })),
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              label="Created from"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From"
            />
            <DesignTicketDateField
              compact
              label="Created to"
              value={dateTo}
              onChange={setDateTo}
              placeholder="To"
            />
          </DesignTicketFilterBar>

          {!hasTickets ? (
            <EmptyState
              title="No client tickets match"
              description="Try a different filter or wait for updates from Ticket Tracking."
            />
          ) : (
            <DataTable
              data={filtered}
              getRowId={(r) => r.id}
              searchKeys={["ticketNumber", "subject", "companyName", "assigneeName", "category"]}
              pageSize={15}
              density="compact"
              onRowClick={(row) =>
                void navigate({ to: "/tickets/$ticketId", params: { ticketId: row.id } })
              }
              columns={[
                {
                  key: "ticketNumber",
                  header: "ID",
                  render: (r) => (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {r.ticketNumber}
                      {r.isNew ? (
                        <span className="rounded bg-primary/15 px-1 py-px text-[9px] font-semibold text-primary">
                          New
                        </span>
                      ) : null}
                    </span>
                  ),
                  sortable: true,
                },
                {
                  key: "subject",
                  header: "Subject",
                  render: (r) => (
                    <span className="line-clamp-1 max-w-[200px]">{r.subject}</span>
                  ),
                  sortable: true,
                },
                {
                  key: "companyName",
                  header: "Company",
                  render: (r) => (
                    <span className="line-clamp-1 max-w-[120px]">{r.companyName}</span>
                  ),
                  sortable: true,
                },
                {
                  key: "priority",
                  header: "Priority",
                  render: (r) => <DesignTicketPriorityChip priority={r.priority} />,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <DesignTicketStatusPill status={r.status} />,
                },
                { key: "assigneeName", header: "Assignee", render: (r) => r.assigneeName },
                {
                  key: "updatedAt",
                  header: "Updated",
                  render: (r) => formatDate(r.updatedAt),
                  sortable: true,
                },
              ]}
              actions={(row) => (
                <TicketRowActions
                  assigneeOptions={assigneeOptions}
                  currentUserId={currentUser?.id}
                  onAssign={(assigneeId, assigneeName) => {
                    assignTicket(row.id, assigneeId, assigneeName, actorName);
                    toast.success("Assignee updated");
                  }}
                  onStatus={(status) => {
                    updateStatus(row.id, status, actorName);
                    toast.success(`Status → ${DESIGN_TICKET_STATUS_LABEL[status]}`);
                  }}
                  onPriority={(priority) => {
                    updatePriority(row.id, priority, actorName);
                    toast.success("Priority updated");
                  }}
                  onDelete={() => {
                    deleteTicket(row.id);
                    toast.success("Client ticket deleted");
                  }}
                />
              )}
            />
          )}
        </div>
      </DesignTicketSection>
    </motion.div>
  );
}

