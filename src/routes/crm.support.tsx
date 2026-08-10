import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kanban, List, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { CRM_TICKET_PROJECT_ID, filterCrmTickets } from "@/lib/crm-tickets";
import { isTicketOpen } from "@/lib/tickets";
import { SUPPORT_PRIORITIES, SUPPORT_TYPES } from "@/lib/support-tracking";
import { cn, formatDate } from "@/lib/utils";
import {
  useAuthStore,
  useCrmAccountStore,
  useTicketStore,
  useUserStore,
} from "@/stores";
import type { TicketPriority, TicketStatus, TicketType } from "@/types";
import { nowIso } from "@/types/common";

export const Route = createFileRoute("/crm/support")({
  component: CrmSupportLayout,
});

function CrmSupportLayout() {
  const childMatches = useChildMatches();
  const isDetail = childMatches.some((m) => m.routeId.includes("$ticketId"));
  if (isDetail) return <Outlet />;
  return <CrmSupportDeskPage />;
}

function CrmSupportDeskPage() {
  const navigate = useNavigate();
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const currentUser = useAuthStore((s) => s.user);
  const users = useUserStore((s) => s.users);

  const crmTickets = useMemo(() => filterCrmTickets(tickets), [tickets]);
  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "Account";
  }, [accounts]);

  const [view, setView] = useState<"board" | "list">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Customization" as TicketType,
    priority: "Medium" as TicketPriority,
    accountId: "",
  });

  const openCount = crmTickets.filter((t) => isTicketOpen(t)).length;
  const criticalCount = crmTickets.filter((t) => t.priority === "Critical" && isTicketOpen(t)).length;
  const resolvedCount = crmTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;

  const assignees = useMemo(
    () => users.filter((u) => u.active && (u.productScope === "crm" || u.role === "Admin")),
    [users],
  );

  function createTicket() {
    if (!form.title.trim()) {
      toast.error("Enter a title");
      return;
    }
    if (!form.accountId) {
      toast.error("Select a CRM account");
      return;
    }
    const today = nowIso().slice(0, 10);
    const ticket = addTicket({
      companyId: form.accountId,
      projectId: CRM_TICKET_PROJECT_ID,
      title: form.title.trim().startsWith("[CRM]")
        ? form.title.trim()
        : `[CRM] ${form.title.trim()}`,
      description: form.description.trim() || "CRM support ticket",
      type: form.type,
      priority: form.priority,
      status: "Open",
      raisedOn: today,
      eta: today,
      developerId: currentUser?.id ?? "",
      assignedUserId: currentUser?.id,
    });
    toast.success("Ticket created");
    setCreateOpen(false);
    setForm({
      title: "",
      description: "",
      type: "Customization",
      priority: "Medium",
      accountId: "",
    });
    void navigate({ to: "/crm/support/$ticketId", params: { ticketId: ticket.id } });
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Support Desk"
        subtitle="CRM implementation tickets across accounts"
        actions={
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New ticket
          </Button>
        }
      />

      <DesignTicketKpiGrid
        size="compact"
        items={[
          { id: "open", label: "Open", value: openCount },
          { id: "critical", label: "Critical open", value: criticalCount },
          { id: "resolved", label: "Resolved / closed", value: resolvedCount },
          { id: "total", label: "Total", value: crmTickets.length },
        ]}
      />

      <DesignTicketTabNav
        compact
        tabs={[
          { id: "board", label: "Board", icon: Kanban },
          { id: "list", label: "List", icon: List },
        ]}
        activeId={view}
        onChange={(id) => setView(id as "board" | "list")}
      />

      {crmTickets.length === 0 ? (
        <EmptyState
          title="No CRM tickets yet"
          description="Create a ticket from here or from an account’s Tickets tab."
          actionLabel="New ticket"
          onAction={() => setCreateOpen(true)}
        />
      ) : view === "board" ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {TICKET_KANBAN_COLUMNS.map((status) => {
            const col = crmTickets.filter((t) => t.status === status);
            return (
              <DesignTicketSection
                key={status}
                compact
                title={status}
                action={
                  <span className="text-[10px] tabular-nums text-muted-foreground">{col.length}</span>
                }
              >
                <div className="space-y-1.5">
                  {col.length === 0 ? (
                    <p className="py-4 text-center text-[10px] text-muted-foreground">Empty</p>
                  ) : (
                    col.map((t) => (
                      <Link
                        key={t.id}
                        to="/crm/support/$ticketId"
                        params={{ ticketId: t.id }}
                        className="card-soft block p-2.5 transition-colors hover:border-primary/40"
                      >
                        <div className="text-xs font-medium leading-snug">{t.title}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {accountName(t.companyId)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Pill tone="accent">{t.priority}</Pill>
                          <Pill tone="muted">{t.type}</Pill>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </DesignTicketSection>
            );
          })}
        </div>
      ) : (
        <DesignTicketSection compact title="All CRM tickets">
          <DataTable
            data={crmTickets}
            getRowId={(t) => t.id}
            hideSearch
            columns={[
              {
                key: "title",
                header: "Ticket",
                render: (t) => (
                  <Link
                    to="/crm/support/$ticketId"
                    params={{ ticketId: t.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {t.title}
                  </Link>
                ),
              },
              {
                key: "account",
                header: "Account",
                render: (t) => accountName(t.companyId),
              },
              {
                key: "status",
                header: "Status",
                render: (t) => (
                  <select
                    className="h-7 rounded border bg-background px-1.5 text-[11px]"
                    value={t.status}
                    onChange={(e) =>
                      updateTicket(t.id, { status: e.target.value as TicketStatus })
                    }
                  >
                    {TICKET_KANBAN_COLUMNS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "priority",
                header: "Priority",
                render: (t) => <Pill tone="accent">{t.priority}</Pill>,
              },
              {
                key: "raised",
                header: "Raised",
                render: (t) => formatDate(t.raisedOn),
              },
            ]}
          />
        </DesignTicketSection>
      )}

      <EntityFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New CRM support ticket"
        submitLabel="Create"
        onSubmit={createTicket}
      >
        <div className="grid gap-2">
          <label className="text-xs font-medium">
            Account
            <select
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm",
              )}
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Title
            <input
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary"
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium">
              Type
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TicketType })}
              >
                {SUPPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Priority
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
              >
                {SUPPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {assignees.length ? (
            <p className="text-[11px] text-muted-foreground">
              Assigned to you by default. Reassign from the ticket detail.
            </p>
          ) : null}
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
