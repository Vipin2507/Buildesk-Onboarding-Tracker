import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketKpiGrid,
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  portalCreatePath,
  portalPublicCreateUrl,
  portalPublicDashboardUrl,
} from "@/lib/design-ticket-portal";
import { formatDate } from "@/lib/utils";
import { copyTextToClipboard, selectInputText } from "@/lib/copy-to-clipboard";
import {
  useCompanyPortalStore,
  useCompanyStore,
  useDesignTicketStats,
  useDesignTicketsForCompany,
  useEmployeeStore,
  useUserStore,
  useDesignTicketStore,
} from "@/stores";
import type { DesignTicket } from "@/types/design-ticket";

type Props = {
  companyId: string;
};

export function CompanyDesignTicketsPanel({ companyId }: Props) {
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const tickets = useDesignTicketsForCompany(companyId);
  const stats = useDesignTicketStats(companyId);
  const portal = useCompanyPortalStore((s) => s.getByCompanyId(companyId));
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const regenerateSlug = useCompanyPortalStore((s) => s.regenerateSlug);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const deleteTicket = useDesignTicketStore((s) => s.deleteTicket);
  const [regenOpen, setRegenOpen] = useState(false);

  useEffect(() => {
    if (company) generateAccess(company);
  }, [company, generateAccess]);

  if (!company) return null;

  const access = portal;
  if (!access) {
    return (
      <div className="text-sm text-muted-foreground">Setting up client portal access…</div>
    );
  }

  const companyName = company.name;

  const publicUrl = portalPublicCreateUrl(access.slug);
  const previewUrl = portalPublicDashboardUrl(access.slug);

  const enriched = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        assignee:
          users.find((u) => u.id === t.assigneeId)?.name ??
          employees.find((e) => e.id === t.assigneeId)?.name ??
          "Unassigned",
      })),
    [tickets, users, employees],
  );

  async function copyLink(inputEl?: HTMLInputElement | null) {
    const ok = await copyTextToClipboard(publicUrl);
    if (ok) {
      toast.success("Portal link copied");
      return;
    }
    if (inputEl) selectInputText(inputEl);
    toast.error("Auto-copy blocked — link selected, press Ctrl+C / Cmd+C");
  }

  function onRegenerate() {
    regenerateSlug(companyId);
    toast.success("Portal link regenerated — old links are now invalid");
    setRegenOpen(false);
  }

  const kpiCards = [
    { label: "Open", value: stats.open, tone: "text-info" },
    { label: "In Progress", value: stats.inProgress, tone: "text-warning-foreground" },
    { label: "Resolved", value: stats.resolved, tone: "text-success" },
    { label: "Closed", value: stats.closed, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: TICKET_EASE }}
        className="card-soft space-y-3 p-4"
      >
        <div className="text-sm font-semibold">Client ticket creation link</div>
        <p className="text-xs text-muted-foreground">
          Share this link with {companyName} so they can raise design & support tickets.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={publicUrl}
            className="font-mono text-xs"
            onFocus={(e) => selectInputText(e.currentTarget)}
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={(e) => {
                const input = e.currentTarget.closest(".card-soft")?.querySelector("input");
                void copyLink(input instanceof HTMLInputElement ? input : null);
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => setRegenOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <Button type="button" variant="secondary" className="gap-1.5" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Preview Portal
              </a>
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Shareable links point to{" "}
          <span className="font-mono">{publicUrl.replace(portalCreatePath(access.slug), "") || "this site"}</span>
          . Update <code className="rounded bg-muted px-1">VITE_PORTAL_BASE_URL</code> in{" "}
          <code className="rounded bg-muted px-1">.env.production</code> if the host changes.
        </p>
      </motion.div>

      <DesignTicketKpiGrid items={kpiCards} columns={4} />

      <DesignTicketSection title="Company Tickets" delay={0.08}>
        {enriched.length === 0 ? (
          <EmptyState
            title="No tickets for this company yet"
            description="When the client creates a ticket from their portal, it will appear here instantly."
          />
        ) : (
          <DataTable
          data={enriched}
          getRowId={(r) => r.id}
          hideSearch
          pageSize={8}
          onRowClick={(row) => {
            window.location.href = `/tickets/${row.id}`;
          }}
          columns={[
            { key: "ticketNumber", header: "Ticket ID", render: (r) => r.ticketNumber, sortable: true },
            { key: "subject", header: "Subject", render: (r) => r.subject, sortable: true },
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
            { key: "assignee", header: "Assignee", render: (r) => r.assignee },
            { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt), sortable: true },
          ]}
          actions={(row: DesignTicket) => (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteTicket(row.id);
                toast.success("Ticket deleted");
              }}
            >
              Delete
            </Button>
          )}
        />
        )}
      </DesignTicketSection>

      <p className="text-center text-xs text-muted-foreground">
        Engineering support tickets (TKT) remain in{" "}
        <Link to="/support" className="text-primary hover:underline">
          Support Desk
        </Link>
        .
      </p>

      <ConfirmDeleteDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate portal link?"
        description="The current client link will stop working. Share the new link with your client after regenerating."
        confirmLabel="Regenerate"
        confirmTone="default"
        onConfirm={onRegenerate}
      />
    </div>
  );
}
