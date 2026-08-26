import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  crmActivityOpenLabel,
  resolveCrmActivityDestination,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";

type CrmActivityOpenLinkItem = Pick<CrmActivityItem, "id" | "category" | "accountId" | "trackerStage">;

type Props = {
  item: CrmActivityOpenLinkItem;
  compact?: boolean;
  onNavigate?: () => void;
};

export function CrmActivityOpenLink({ item, compact = false, onNavigate }: Props) {
  const destination = resolveCrmActivityDestination(item);
  if (!destination) return null;

  const label = crmActivityOpenLabel(item.category, item.trackerStage);
  const className = compact
    ? "h-7 gap-1 px-2 text-[10px]"
    : "h-7 gap-1 px-2.5 text-[10px]";

  if (destination.kind === "account") {
    return (
      <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
        <Link
          to="/crm/accounts/$accountId"
          params={{ accountId: destination.accountId }}
          search={
            destination.tab && destination.tab !== "dashboard"
              ? { tab: destination.tab }
              : {}
          }
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
        <Link to="/crm/bookings" search={{ tab: "all" }}>
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
          search={destination.taskId ? { tab: "all", taskId: destination.taskId } : { tab: "all" }}
        >
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className={className} asChild onClick={onNavigate}>
      <Link to="/client-visits">
        {label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </Button>
  );
}
