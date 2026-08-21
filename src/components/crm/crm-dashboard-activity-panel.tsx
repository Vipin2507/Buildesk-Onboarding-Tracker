import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Calendar,
  History,
  LifeBuoy,
  MessageSquare,
  MessageSquareText,
  Package,
  Ticket,
} from "lucide-react";

import { ListToolbar } from "@/components/list-toolbar";
import { Pill } from "@/components/status-pill";
import {
  countCrmActivityByCategory,
  CRM_ACTIVITY_CATEGORY_LABEL,
  filterCrmActivityItems,
  groupCrmActivityByDate,
  type CrmActivityCategory,
  type CrmActivityDateRange,
  type CrmActivityItem,
} from "@/lib/crm-activity-feed";
import { formatRelativeTime } from "@/types/common";
import type { ActivityKind } from "@/types";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const CATEGORY_ICONS: Record<Exclude<CrmActivityCategory, "all">, typeof Building2> = {
  account: Building2,
  tracker: History,
  module: Package,
  booking: Calendar,
  support: LifeBuoy,
  ticket: Ticket,
  communication: MessageSquare,
};

const KIND_TONE: Record<ActivityKind, "success" | "warning" | "danger" | "muted"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "muted",
};

type Props = {
  items: CrmActivityItem[];
  accounts: { id: string; name: string }[];
};

function ActivityLink({
  item,
  children,
  className,
}: {
  item: CrmActivityItem;
  children: ReactNode;
  className?: string;
}) {
  if (!item.href) {
    return <div className={className}>{children}</div>;
  }
  if (item.href.startsWith("/crm/accounts/")) {
    const accountId = item.href.slice("/crm/accounts/".length);
    return (
      <Link to="/crm/accounts/$accountId" params={{ accountId }} className={className}>
        {children}
      </Link>
    );
  }
  if (item.href.startsWith("/crm/support/")) {
    const ticketId = item.href.slice("/crm/support/".length);
    return (
      <Link to="/crm/support/$ticketId" params={{ ticketId }} className={className}>
        {children}
      </Link>
    );
  }
  if (item.href.startsWith("/crm/tickets/")) {
    const ticketId = item.href.slice("/crm/tickets/".length);
    return (
      <Link to="/crm/tickets/$ticketId" params={{ ticketId }} className={className}>
        {children}
      </Link>
    );
  }
  if (item.href === "/crm/bookings") {
    return (
      <Link to="/crm/bookings" search={{ tab: "pending" }} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

function CategoryBadge({ category }: { category: Exclude<CrmActivityCategory, "all"> }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      {CRM_ACTIVITY_CATEGORY_LABEL[category]}
    </span>
  );
}

export function CrmDashboardActivityPanel({ items, accounts }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CrmActivityCategory>("all");
  const [accountId, setAccountId] = useState("all");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [dateRange, setDateRange] = useState<CrmActivityDateRange>("30d");

  const categoryCounts = useMemo(() => countCrmActivityByCategory(items), [items]);

  const filtered = useMemo(
    () =>
      filterCrmActivityItems(items, {
        category,
        accountId,
        kind,
        query,
        dateRange,
      }),
    [items, category, accountId, kind, query, dateRange],
  );

  const grouped = useMemo(() => groupCrmActivityByDate(filtered), [filtered]);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (accountId !== "all" ? 1 : 0) +
    (kind !== "all" ? 1 : 0) +
    (dateRange !== "30d" ? 1 : 0);

  const categoryChips = useMemo(
    () =>
      (
        [
          { id: "all" as const, label: "All activity" },
          { id: "account" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.account },
          { id: "tracker" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.tracker },
          { id: "module" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.module },
          { id: "booking" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.booking },
          { id: "support" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.support },
          { id: "ticket" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.ticket },
          { id: "communication" as const, label: CRM_ACTIVITY_CATEGORY_LABEL.communication },
        ] as const
      ).map((c) => ({
        id: c.id,
        label: c.label,
        count: categoryCounts[c.id],
      })),
    [categoryCounts],
  );

  const accountOptions = useMemo(
    () => [
      { value: "all", label: "All accounts" },
      ...[...accounts]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [accounts],
  );

  return (
    <div className="space-y-2.5">
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search activity, account, or user…"
        chips={categoryChips}
        activeChip={category}
        onChipChange={(id) => setCategory(id as CrmActivityCategory)}
        defaultFiltersOpen
        selects={[
          {
            id: "account",
            label: "Account",
            value: accountId,
            options: accountOptions,
            onChange: setAccountId,
          },
          {
            id: "kind",
            label: "Status",
            value: kind,
            options: [
              { value: "all", label: "All statuses" },
              { value: "success", label: "Success / completed" },
              { value: "info", label: "Info / in progress" },
              { value: "warning", label: "Needs attention" },
              { value: "danger", label: "Failed / cancelled" },
            ],
            onChange: (v) => setKind(v as ActivityKind | "all"),
          },
          {
            id: "range",
            label: "Time range",
            value: dateRange,
            options: [
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "all", label: "All time" },
            ],
            onChange: (v) => setDateRange(v as CrmActivityDateRange),
          },
        ]}
        resultCount={filtered.length}
        resultLabel="events"
        activeFilterCount={activeFilterCount}
        onClear={() => {
          setQuery("");
          setCategory("all");
          setAccountId("all");
          setKind("all");
          setDateRange("30d");
        }}
      />

      <div className="grid gap-2 sm:grid-cols-4">
        {(
          [
            { label: "Account events", key: "account" as const },
            { label: "Implementation", key: "tracker" as const },
            { label: "Bookings", key: "booking" as const },
            { label: "Support & tickets", key: "support" as const, extra: categoryCounts.ticket },
          ] as const
        ).map((stat, i) => {
          const count =
            stat.key === "support"
              ? categoryCounts.support + (stat.extra ?? 0)
              : categoryCounts[stat.key];
          return (
            <motion.button
              key={stat.key}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.28, ease: EASE }}
              onClick={() => setCategory(stat.key === "support" ? "support" : stat.key)}
              className={cn(
                "card-soft rounded-lg p-3 text-left transition-colors hover:bg-muted/40",
                category === stat.key && "ring-1 ring-primary/30",
              )}
            >
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{count}</div>
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 py-12 text-center">
          <MessageSquareText className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No activity matches your filters</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Try widening the date range or clearing filters. Activity from bookings, tickets,
            subscriptions, communications, and tracker updates appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key} className="card-soft overflow-hidden">
              <div className="border-b bg-muted/40 px-3 py-2">
                <h3 className="text-xs font-semibold">{group.label}</h3>
                <p className="text-[10px] text-muted-foreground">{group.items.length} events</p>
              </div>

              <div className="hidden md:block">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-[10px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Activity</th>
                      <th className="px-3 py-2 text-left font-medium">Account</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-left font-medium">By</th>
                      <th className="px-3 py-2 text-left font-medium">When</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/25">
                        <td className="max-w-[220px] px-3 py-2">
                          <div className="line-clamp-2 font-medium">{item.what}</div>
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">
                          {item.accountName ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <CategoryBadge category={item.category} />
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-muted-foreground">
                          {item.who}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          <span title={new Date(item.createdAt).toLocaleString()}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Pill tone={KIND_TONE[item.kind]}>{item.kind}</Pill>
                        </td>
                        <td className="px-2 py-2 text-right">
                          {item.href ? (
                            <ActivityLink
                              item={item}
                              className="inline-flex h-7 items-center gap-0.5 px-1.5 text-primary hover:underline"
                            >
                              Open <ArrowRight className="h-3 w-3" />
                            </ActivityLink>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ol className="divide-y md:hidden">
                {group.items.map((item, index) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.25, ease: EASE }}
                  >
                    <ActivityLink
                      item={item}
                      className="block px-3 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-medium">{item.what}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {item.accountName} · {item.who}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <CategoryBadge category={item.category} />
                            <Pill tone={KIND_TONE[item.kind]}>{item.kind}</Pill>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </ActivityLink>
                  </motion.li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
