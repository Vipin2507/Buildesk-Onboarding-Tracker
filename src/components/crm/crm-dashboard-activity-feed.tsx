import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { CrmActivityOpenLink } from "@/components/crm/crm-activity-open-link";
import { Pill } from "@/components/status-pill";
import {
  CRM_ACTIVITY_CATEGORY_LABEL,
  crmActivityExecutiveDisplay,
  resolveCrmActivityDestination,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";
import { cn, formatTime } from "@/lib/utils";
import { formatRelativeTime } from "@/types/common";
import type { ActivityKind } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export type CrmDashboardActivityItem = Pick<
  CrmActivityItem,
  | "id"
  | "what"
  | "executive"
  | "createdAt"
  | "kind"
  | "href"
  | "category"
  | "accountId"
  | "accountName"
  | "remarks"
>;

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
  const executive = crmActivityExecutiveDisplay({ executive: item.executive });
  const destination = resolveCrmActivityDestination(item);
  const categoryLabel = CRM_ACTIVITY_CATEGORY_LABEL[item.category];

  const inner = (
    <>
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", kindDot[item.kind] ?? kindDot.info)}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryLabel ? (
            <Pill tone="muted" className="text-[9px]">
              {categoryLabel}
            </Pill>
          ) : null}
          {item.accountName ? (
            <span className="truncate text-[10px] font-medium text-primary">{item.accountName}</span>
          ) : null}
        </div>
        <div className="line-clamp-2 text-xs leading-snug">{item.what}</div>
        {item.remarks && item.remarks !== item.what ? (
          <div className="line-clamp-1 text-[10px] text-muted-foreground">{item.remarks}</div>
        ) : null}
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {executive} · {formatTime(item.createdAt)} · {formatRelativeTime(item.createdAt)}
        </div>
      </div>
      {destination ? (
        <div className="shrink-0 self-center opacity-80 transition-opacity group-hover:opacity-100">
          <CrmActivityOpenLink item={item} compact />
        </div>
      ) : null}
    </>
  );

  const className =
    "group flex items-start gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/50";

  const content: ReactNode = destination ? (
    <div className={className}>{inner}</div>
  ) : item.accountId ? (
    <Link
      to="/crm/accounts/$accountId"
      params={{ accountId: item.accountId }}
      className={className}
    >
      {inner}
    </Link>
  ) : (
    <div className={cn(className, "px-1")}>{inner}</div>
  );

  return (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28, ease: EASE }}
    >
      {content}
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
