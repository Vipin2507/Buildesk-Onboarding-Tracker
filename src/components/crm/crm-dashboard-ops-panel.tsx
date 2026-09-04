import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CheckSquare, MessageSquare } from "lucide-react";

import { Pill } from "@/components/status-pill";
import { cn, formatDate } from "@/lib/utils";
import { formatRelativeTime } from "@/types/common";
import type {
  CrmDashboardQueryItem,
  CrmDashboardTaskItem,
} from "@/stores/crm-dashboard-selectors";
import { crmAccountQueryCategoryLabel } from "@/types/crm-account-query";

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  tasks: CrmDashboardTaskItem[];
  queries: CrmDashboardQueryItem[];
  taskTotals: {
    open: number;
    overdue: number;
    dueToday: number;
  };
  queryTotal: number;
};

function taskTone(task: CrmDashboardTaskItem) {
  if (task.overdue) return "danger" as const;
  if (task.dueToday) return "warning" as const;
  if (task.priority === "urgent" || task.priority === "high") return "warning" as const;
  return "muted" as const;
}

export function CrmDashboardOpsPanel({ tasks, queries, taskTotals, queryTotal }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.13, ease: EASE }}
      className="grid gap-2.5 lg:grid-cols-2"
    >
      <div className="card-soft p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold">Follow-up tasks</h3>
          </div>
          <Link
            to="/crm/tasks"
            search={{ tab: "open" }}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
          >
            Task hub
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-md border bg-muted/30 px-2 py-0.5">
            <span className="font-semibold text-foreground">{taskTotals.open}</span> open
          </span>
          {taskTotals.overdue > 0 ? (
            <Link
              to="/crm/tasks"
              search={{ tab: "overdue" }}
              className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive hover:opacity-90"
            >
              <span className="font-semibold">{taskTotals.overdue}</span> overdue
            </Link>
          ) : null}
          {taskTotals.dueToday > 0 ? (
            <Link
              to="/crm/tasks"
              search={{ tab: "today" }}
              className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning-foreground hover:opacity-90"
            >
              <span className="font-semibold">{taskTotals.dueToday}</span> due today
            </Link>
          ) : null}
        </div>

        {tasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No open follow-up tasks.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  to="/crm/tasks"
                  search={{ tab: "open", taskId: task.id }}
                  className="block rounded-lg border px-2.5 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{task.title}</div>
                      <div className="mt-0.5 truncate text-[10px] text-primary">{task.accountName}</div>
                    </div>
                    <Pill tone={taskTone(task)} className="shrink-0 text-[9px]">
                      {task.overdue ? "Overdue" : task.dueToday ? "Today" : task.status.replace("_", " ")}
                    </Pill>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {task.assigneeLabel || "Unassigned"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
                    {" · "}
                    {task.priority} priority
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-soft p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold">Account queries</h3>
          </div>
          <Link
            to="/crm/queries"
            search={{ status: "open" }}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
          >
            Query hub
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mb-2 text-[10px]">
          <span className="rounded-md border bg-muted/30 px-2 py-0.5">
            <span className="font-semibold text-foreground">{queryTotal}</span> open{" "}
            {queryTotal === 1 ? "query" : "queries"}
          </span>
        </div>

        {queries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No open account queries.</p>
        ) : (
          <ul className="space-y-1.5">
            {queries.map((query) => (
              <li key={query.id}>
                <Link
                  to="/crm/queries"
                  search={{ status: "open", queryId: query.id }}
                  className="block rounded-lg border px-2.5 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{query.title}</div>
                      <div className="mt-0.5 truncate text-[10px] text-primary">{query.accountName}</div>
                    </div>
                    {query.category ? (
                      <Pill tone="muted" className="shrink-0 text-[9px]">
                        {crmAccountQueryCategoryLabel(query.category)}
                      </Pill>
                    ) : null}
                  </div>
                  <div className={cn("mt-1 text-[10px] text-muted-foreground")}>
                    Updated {formatRelativeTime(query.updatedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
