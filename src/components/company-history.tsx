import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Search,
} from "lucide-react";

import { Pill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { useActivityStore, useProjectStore, usePostSalesStore } from "@/stores";
import type { ActivityKind } from "@/types";
import { formatRelativeTime } from "@/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  ActivityKind,
  { label: string; tone: "success" | "info" | "warning" | "danger"; Icon: typeof Info }
> = {
  success: { label: "Success", tone: "success", Icon: CheckCircle2 },
  info: { label: "Update", tone: "info", Icon: Info },
  warning: { label: "Warning", tone: "warning", Icon: AlertTriangle },
  danger: { label: "Issue", tone: "danger", Icon: XCircle },
};

const KIND_FILTERS = ["All", "Success", "Update", "Warning", "Issue"] as const;

function kindFromFilter(filter: (typeof KIND_FILTERS)[number]): ActivityKind | null {
  if (filter === "All") return null;
  if (filter === "Success") return "success";
  if (filter === "Update") return "info";
  if (filter === "Warning") return "warning";
  return "danger";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CompanyHistoryTab({ companyId }: { companyId: string }) {
  const allActivities = useActivityStore((s) => s.activities);
  const onboardingProjects = useProjectStore((s) => s.projects);
  const postSalesProjects = usePostSalesStore((s) => s.projects);

  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  const activities = useMemo(() => {
    const kind = kindFromFilter(kindFilter);
    const q = query.trim().toLowerCase();
    return allActivities
      .filter((a) => a.companyId === companyId)
      .filter((a) => (kind ? a.kind === kind : true))
      .filter((a) => {
        if (!q) return true;
        return (
          a.what.toLowerCase().includes(q)
          || a.who.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allActivities, companyId, kindFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof activities>();
    for (const a of activities) {
      const key = dayKey(a.createdAt);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [activities]);

  function projectLabel(projectId?: string) {
    if (!projectId) return null;
    const onboarding = onboardingProjects.find((p) => p.id === projectId);
    if (onboarding) return onboarding.name;
    const ps = postSalesProjects.find((p) => p.id === projectId);
    if (ps) return `${ps.projectNumber} · ${ps.projectName}`;
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">Customer History</h3>
          <p className="text-xs text-muted-foreground">
            Full audit trail of every update for this company
          </p>
        </div>
        <Pill>{activities.length} events</Pill>
      </div>

      <div className="card-soft flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by action or person…"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setKindFilter(f)}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                kindFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card-soft p-5">

      {grouped.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Uploads, approvals, notes, and other company updates will appear here chronologically."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <section key={day}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </div>
              <ol className="relative space-y-0 border-l border-border pl-5">
                {items.map((a) => {
                  const meta = KIND_META[a.kind];
                  const Icon = meta.Icon;
                  const project = projectLabel(a.projectId);
                  return (
                    <li key={a.id} className="relative pb-5 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-[1.6rem] flex h-6 w-6 items-center justify-center rounded-full border bg-background",
                          a.kind === "success" && "text-success",
                          a.kind === "info" && "text-primary",
                          a.kind === "warning" && "text-warning",
                          a.kind === "danger" && "text-destructive",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="rounded-lg border bg-muted/15 p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateTime(a.createdAt)} · {formatRelativeTime(a.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{a.what}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          by {a.who}
                          {project && <> · {project}</>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
