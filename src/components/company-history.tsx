import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Search,
  CheckSquare,
  MapPin,
} from "lucide-react";

import { Pill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import {
  useActivityStore,
  useCrmEventStore,
  useProjectStore,
  usePostSalesStore,
  useTaskStore,
  useClientVisitStore,
} from "@/stores";
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

const ENTITY_FILTERS = ["All", "Tasks", "Visits", "Activity", "Subscriptions"] as const;
const KIND_FILTERS = ["All", "Success", "Update", "Warning", "Issue"] as const;

type TimelineItem = {
  id: string;
  createdAt: string;
  who: string;
  what: string;
  kind: ActivityKind;
  entity: "task" | "visit" | "subscription" | "activity";
  projectId?: string;
};

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

function crmKind(eventType: string): ActivityKind {
  if (eventType.includes("completed") || eventType.includes("active")) return "success";
  if (eventType.includes("cancelled") || eventType.includes("expired")) return "danger";
  if (eventType.includes("paused") || eventType.includes("blocked")) return "warning";
  return "info";
}

export function CompanyHistoryTab({ companyId }: { companyId: string }) {
  const allActivities = useActivityStore((s) => s.activities);
  const crmEvents = useCrmEventStore((s) => s.events);
  const tasks = useTaskStore((s) => s.tasks);
  const visits = useClientVisitStore((s) => s.visits);
  const onboardingProjects = useProjectStore((s) => s.projects);
  const postSalesProjects = usePostSalesStore((s) => s.projects);

  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>("All");
  const [entityFilter, setEntityFilter] = useState<(typeof ENTITY_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  const openTasks = tasks.filter(
    (t) => t.companyId === companyId && ["open", "in_progress", "blocked"].includes(t.status),
  ).length;
  const visitCount = visits.filter((v) => v.companyId === companyId).length;
  const completedVisits = visits.filter(
    (v) => v.companyId === companyId && v.status === "completed",
  ).length;

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const a of allActivities.filter((x) => x.companyId === companyId)) {
      items.push({
        id: `act-${a.id}`,
        createdAt: a.createdAt,
        who: a.who,
        what: a.what,
        kind: a.kind,
        entity: "activity",
        projectId: a.projectId,
      });
    }

    for (const e of crmEvents.filter((x) => x.companyId === companyId)) {
      const entity =
        e.entityType === "task"
          ? "task"
          : e.entityType === "visit"
            ? "visit"
            : e.entityType === "subscription"
              ? "subscription"
              : "activity";
      items.push({
        id: `crm-${e.id}`,
        createdAt: e.createdAt,
        who: e.actorName,
        what: e.remark ? `${e.eventType.replace(/_/g, " ")} — ${e.remark}` : e.eventType.replace(/_/g, " "),
        kind: crmKind(e.eventType),
        entity,
      });
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allActivities, crmEvents, companyId]);

  const activities = useMemo(() => {
    const kind = kindFromFilter(kindFilter);
    const q = query.trim().toLowerCase();
    return timeline
      .filter((a) => (kind ? a.kind === kind : true))
      .filter((a) => {
        if (entityFilter === "All") return true;
        if (entityFilter === "Tasks") return a.entity === "task";
        if (entityFilter === "Visits") return a.entity === "visit";
        if (entityFilter === "Subscriptions") return a.entity === "subscription";
        return a.entity === "activity";
      })
      .filter((a) => {
        if (!q) return true;
        return a.what.toLowerCase().includes(q) || a.who.toLowerCase().includes(q);
      });
  }, [timeline, kindFilter, entityFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof activities>();
    for (const a of activities) {
      const key = dayKey(a.createdAt);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [activities]);

  const projectName = (projectId?: string) => {
    if (!projectId) return null;
    return (
      onboardingProjects.find((p) => p.id === projectId)?.name ??
      postSalesProjects.find((p) => p.id === projectId)?.projectName ??
      null
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Total visits
          </div>
          <div className="mt-1 text-xl font-semibold">{visitCount}</div>
          <div className="text-xs text-muted-foreground">{completedVisits} completed</div>
        </div>
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" /> Open tasks
          </div>
          <div className="mt-1 text-xl font-semibold">{openTasks}</div>
          <div className="text-xs text-muted-foreground">
            {tasks.filter((t) => t.companyId === companyId).length} total follow-ups
          </div>
        </div>
        <div className="card-soft p-4">
          <div className="text-xs text-muted-foreground">Timeline events</div>
          <div className="mt-1 text-xl font-semibold">{timeline.length}</div>
          <div className="text-xs text-muted-foreground">Tasks, visits, and activity</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold">Client timeline</h3>
          <p className="text-xs text-muted-foreground">
            Chronological activity across follow-ups, visits, and operational events.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search timeline…"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setEntityFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              entityFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setKindFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              kindFilter === f ? "bg-foreground text-background" : "border text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {activities.length === 0 ? (
        <EmptyState
          title="No timeline events yet"
          description="Follow-up tasks, visits, and operational updates will appear here."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </div>
              <div className="space-y-2">
                {items.map((a) => {
                  const meta = KIND_META[a.kind];
                  const Icon = meta.Icon;
                  const proj = projectName(a.projectId);
                  return (
                    <div key={a.id} className="card-soft flex gap-3 p-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          a.kind === "success" && "bg-success/10 text-success",
                          a.kind === "info" && "bg-primary/10 text-primary",
                          a.kind === "warning" && "bg-warning/10 text-warning",
                          a.kind === "danger" && "bg-destructive/10 text-destructive",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{a.what}</span>
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          <Pill>{a.entity}</Pill>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {a.who} · {formatDateTime(a.createdAt)} · {formatRelativeTime(a.createdAt)}
                          {proj ? ` · ${proj}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
