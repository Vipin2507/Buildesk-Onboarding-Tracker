import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  crmActivityOpenLabel,
  resolveCrmActivityDestination,
  type CrmActivityDestination,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";

type CrmActivityOpenLinkItem = Pick<
  CrmActivityItem,
  "id" | "entityId" | "category" | "accountId" | "trackerStage" | "moduleKey"
>;

type Props = {
  item: CrmActivityOpenLinkItem;
  compact?: boolean;
  onNavigate?: () => void;
};

function accountSearch(destination: Extract<CrmActivityDestination, { kind: "account" }>) {
  const search: Record<string, string> = {};
  if (destination.tab && destination.tab !== "dashboard") {
    search.tab = destination.tab;
  }
  if (destination.queryId) {
    search.queryId = destination.queryId;
  }
  return search;
}

export function navigateToCrmActivityDestination(
  destination: CrmActivityDestination,
  navigate: ReturnType<typeof useNavigate>,
) {
  switch (destination.kind) {
    case "account":
      void navigate({
        to: "/crm/accounts/$accountId",
        params: { accountId: destination.accountId },
        search: accountSearch(destination),
      });
      break;
    case "crm-ticket":
      void navigate({
        to: "/crm/tickets/$ticketId",
        params: { ticketId: destination.ticketId },
      });
      break;
    case "support-ticket":
      void navigate({
        to: "/crm/support/$ticketId",
        params: { ticketId: destination.ticketId },
      });
      break;
    case "bookings":
      void navigate({
        to: "/crm/bookings",
        search: destination.appointmentId
          ? { tab: "all", appointmentId: destination.appointmentId }
          : { tab: "all" },
      });
      break;
    case "tasks":
      void navigate({
        to: "/crm/tasks",
        search: destination.taskId ? { tab: "all", taskId: destination.taskId } : { tab: "all" },
      });
      break;
    case "visits":
      void navigate({
        to: "/client-visits",
        search: destination.visitId ? { visitId: destination.visitId } : {},
      });
      break;
    case "queries":
      if (destination.accountId && destination.queryId) {
        void navigate({
          to: "/crm/accounts/$accountId",
          params: { accountId: destination.accountId },
          search: { tab: "queries", queryId: destination.queryId },
        });
        break;
      }
      void navigate({
        to: "/crm/queries",
        search: destination.queryId ? { queryId: destination.queryId } : {},
      });
      break;
    default:
      break;
  }
}

export function CrmActivityOpenLink({ item, compact = false, onNavigate }: Props) {
  const navigate = useNavigate();
  const destination = resolveCrmActivityDestination(item);
  if (!destination) return null;

  const label = crmActivityOpenLabel(item.category, item.trackerStage);
  const className = compact
    ? "h-7 gap-1 px-2 text-[10px]"
    : "h-7 gap-1 px-2.5 text-[10px]";

  function handleNavigate() {
    onNavigate?.();
    navigateToCrmActivityDestination(destination, navigate);
  }

  if (destination.kind === "account") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/crm/accounts/$accountId"
          params={{ accountId: destination.accountId }}
          search={accountSearch(destination)}
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "crm-ticket") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link to="/crm/tickets/$ticketId" params={{ ticketId: destination.ticketId }}>
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "support-ticket") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link to="/crm/support/$ticketId" params={{ ticketId: destination.ticketId }}>
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "bookings") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/crm/bookings"
          search={
            destination.appointmentId
              ? { tab: "all", appointmentId: destination.appointmentId }
              : { tab: "all" }
          }
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "tasks") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/crm/tasks"
          search={
            destination.taskId ? { tab: "all", taskId: destination.taskId } : { tab: "all" }
          }
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "visits") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/client-visits"
          search={destination.visitId ? { visitId: destination.visitId } : {}}
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (destination.kind === "queries") {
    if (destination.accountId && destination.queryId) {
      return (
        <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
          <Link
            to="/crm/accounts/$accountId"
            params={{ accountId: destination.accountId }}
            search={{ tab: "queries", queryId: destination.queryId }}
          >
            {label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      );
    }
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/crm/queries"
          search={destination.queryId ? { queryId: destination.queryId } : {}}
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className={className} onClick={handleNavigate}>
      {label}
      <ArrowRight className="h-3 w-3" />
    </Button>
  );
}
