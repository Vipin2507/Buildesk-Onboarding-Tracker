import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { formatRelativeTime } from "@/types/common";
import type { ActivityKind } from "@/types";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type CrmDashboardActivityItem = {
  id: string;
  what: string;
  who: string;
  createdAt: string;
  kind: ActivityKind;
  href?: string;
  category?: import("@/lib/crm-activity-feed").CrmActivityCategory;
  accountId?: string;
  accountName?: string;
};

const kindDot: Record<ActivityKind, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
};

type Props = {
  items: CrmDashboardActivityItem[];
  onViewAll?: () => void;
};

function ActivityRow({
  item,
  index,
}: {
  item: CrmDashboardActivityItem;
  index: number;
}) {
  const inner = (
    <>
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", kindDot[item.kind] ?? kindDot.info)}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-xs leading-snug">{item.what}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {item.who} · {formatRelativeTime(item.createdAt)}
        </div>
      </div>
      {item.href ? (
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </>
  );

  const className = "group flex gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/50";

  let link: ReactNode;
  if (!item.href) {
    link = <div className={cn(className, "px-1")}>{inner}</div>;
  } else if (item.href.startsWith("/crm/accounts/")) {
    const accountId = item.href.slice("/crm/accounts/".length);
    link = (
      <Link to="/crm/accounts/$accountId" params={{ accountId }} className={className}>
        {inner}
      </Link>
    );
  } else if (item.href.startsWith("/crm/support/")) {
    const ticketId = item.href.slice("/crm/support/".length);
    link = (
      <Link to="/crm/support/$ticketId" params={{ ticketId }} className={className}>
        {inner}
      </Link>
    );
  } else if (item.href.startsWith("/crm/tickets/")) {
    const ticketId = item.href.slice("/crm/tickets/".length);
    link = (
      <Link to="/crm/tickets/$ticketId" params={{ ticketId }} className={className}>
        {inner}
      </Link>
    );
  } else if (item.href === "/crm/bookings") {
    link = (
      <Link to="/crm/bookings" search={{ tab: "pending" }} className={className}>
        {inner}
      </Link>
    );
  } else {
    link = <div className={cn(className, "px-1")}>{inner}</div>;
  }

  return (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28, ease: EASE }}
    >
      {link}
    </motion.li>
  );
}

export function CrmDashboardActivityFeed({ items, onViewAll }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          Activity from bookings, tickets, subscriptions, and account updates will appear here.
        </p>
        <Link to="/crm/accounts" className="text-xs font-medium text-primary hover:underline">
          Open accounts
        </Link>
      </div>
    );
  }

  return (
    <ol className="space-y-1">
      {items.map((a, i) => (
        <ActivityRow key={a.id} item={a} index={i} />
      ))}
      {onViewAll ? (
        <li className="pt-1">
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            View all activity
          </button>
        </li>
      ) : null}
    </ol>
  );
}
