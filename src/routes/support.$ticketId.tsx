import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useTicketStore, useCompanyStore, useEmployeeStore } from "@/stores";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { EntityNotFound } from "@/components/empty-state";
import { useDetailLoading } from "@/hooks/use-detail-loading";

export const Route = createFileRoute("/support/$ticketId")({
  component: TicketDetail,
});

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const loading = useDetailLoading();
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.id === ticketId));
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === ticket?.companyId));
  const developer = useEmployeeStore((s) => s.employees.find((e) => e.id === ticket?.developerId));

  if (loading) return <DetailPageSkeleton />;
  if (!ticket) return <EntityNotFound entity="Ticket" listPath="/support" listLabel="Support" />;

  return (
    <PageWrap>
      <PageHeader title={ticket.title} subtitle={ticket.id} />
      <div className="card-soft grid gap-4 p-4 sm:grid-cols-2 sm:p-5 md:grid-cols-2">
        <div><div className="text-xs text-muted-foreground">Type</div><Pill tone={ticket.type === "Bug" ? "danger" : "info"}>{ticket.type}</Pill></div>
        <div><div className="text-xs text-muted-foreground">Priority</div><Pill tone="warning">{ticket.priority}</Pill></div>
        <div><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{ticket.status}</div></div>
        <div><div className="text-xs text-muted-foreground">Company</div><div>{company?.name}</div></div>
        <div><div className="text-xs text-muted-foreground">Developer</div><div>{developer?.name}</div></div>
        <div><div className="text-xs text-muted-foreground">ETA</div><div>{ticket.eta}</div></div>
      </div>
    </PageWrap>
  );
}
