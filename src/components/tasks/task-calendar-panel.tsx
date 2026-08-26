import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { ListToolbar } from "@/components/list-toolbar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskType,
} from "@/types";
import { formatTimeRange12h, formatDurationMinutes, resolveTaskDurationMinutes } from "@/lib/task-scheduling";
import { cn, formatDate } from "@/lib/utils";
import { resolveAssigneeLabel } from "@/lib/managers";
import type { User } from "@/types";

export type TaskCalendarView = "list" | "day" | "week" | "month";

type Props = {
  tasks: FollowUpTask[];
  users: User[];
  companies: { id: string; name: string }[];
  view: TaskCalendarView;
  onViewChange: (view: TaskCalendarView) => void;
  onTaskClick?: (task: FollowUpTask) => void;
  selectedTaskId?: string;
  renderTaskDetail?: (task: FollowUpTask) => ReactNode;
  canManage?: boolean;
  /** Hide search/filters — parent provides them */
  embedded?: boolean;
  /** Hide day/week/month/list toggle — parent controls view via URL */
  hideViewToggle?: boolean;
  /** Where "Open" links go — CRM tasks use account IDs, not ERP company IDs */
  entityLinkTarget?: "company" | "crm";
};

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function taskDate(task: FollowUpTask): string | undefined {
  return task.startsAt?.slice(0, 10) ?? task.dueDate;
}

function taskSortKey(task: FollowUpTask): string {
  return task.startsAt ?? `${task.dueDate ?? "9999"}T23:59:59`;
}

function statusTone(status: FollowUpTask["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "blocked") return "warning" as const;
  return "muted" as const;
}

export function TaskCalendarPanel({
  tasks,
  users,
  companies,
  view,
  onViewChange,
  onTaskClick,
  selectedTaskId,
  renderTaskDetail,
  embedded = false,
  hideViewToggle = false,
  entityLinkTarget = "company",
}: Props) {
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (typeFilter !== "all" && task.taskType !== typeFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (!q) return true;
      const company = companies.find((c) => c.id === task.companyId)?.name ?? "";
      return (
        task.title.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, typeFilter, statusFilter, query, companies]);

  const weekStart = startOfWeek(cursorDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayTasks = filtered
    .filter((t) => taskDate(t) === cursorDate)
    .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)));

  const weekTasksByDay = useMemo(() => {
    const map = new Map<string, FollowUpTask[]>();
    for (const day of weekDays) map.set(day, []);
    for (const task of filtered) {
      const d = taskDate(task);
      if (d && map.has(d)) map.get(d)!.push(task);
    }
    for (const [, list] of map) list.sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)));
    return map;
  }, [filtered, weekDays]);

  const monthYmd = cursorDate.slice(0, 7);
  const monthTasks = filtered.filter((t) => (taskDate(t) ?? "").startsWith(monthYmd));

  const viewTabs: { id: TaskCalendarView; label: string }[] = [
    { id: "list", label: "List" },
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ];

  function shiftCursor(delta: number) {
    if (view === "month") {
      const d = new Date(`${cursorDate.slice(0, 7)}-01T12:00:00`);
      d.setMonth(d.getMonth() + delta);
      setCursorDate(d.toISOString().slice(0, 10));
      return;
    }
    setCursorDate(addDays(cursorDate, view === "week" ? delta * 7 : delta));
  }

  return (
    <div className="space-y-2.5">
      {!hideViewToggle ? (
      <div className="flex items-center gap-1 rounded-lg border p-0.5">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === tab.id ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
            )}
            onClick={() => onViewChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      ) : null}

      {view !== "list" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => shiftCursor(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[9rem] text-center text-xs font-medium">
              {view === "day"
                ? formatDate(cursorDate)
                : view === "week"
                  ? `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`
                  : new Date(`${monthYmd}-01T12:00:00`).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
            </span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => shiftCursor(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setCursorDate(new Date().toISOString().slice(0, 10))}
            >
              Today
            </Button>
          </div>
        </div>
      ) : null}

      {!embedded ? (
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search tasks…"
        resultCount={filtered.length}
        resultLabel="tasks"
        selects={[
          {
            id: "type",
            label: "Task type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "all", label: "All types" },
              ...Object.entries(FOLLOW_UP_TASK_TYPE_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In progress" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
      />
      ) : null}

      {view === "list" ? (
        <TaskListTable
          tasks={[...filtered].sort((a, b) => taskSortKey(b).localeCompare(taskSortKey(a)))}
          users={users}
          companies={companies}
          onTaskClick={onTaskClick}
          selectedTaskId={selectedTaskId}
          renderTaskDetail={renderTaskDetail}
          entityLinkTarget={entityLinkTarget}
        />
      ) : null}

      {view === "day" ? (
        <ScheduleDayColumn
          date={cursorDate}
          tasks={dayTasks}
          users={users}
          onTaskClick={onTaskClick}
          selectedTaskId={selectedTaskId}
          renderTaskDetail={renderTaskDetail}
        />
      ) : null}

      {view === "week" ? (
        <div className="grid gap-2 lg:grid-cols-7">
          {weekDays.map((day) => (
            <ScheduleDayColumn
              key={day}
              date={day}
              tasks={weekTasksByDay.get(day) ?? []}
              users={users}
              compact
              onTaskClick={onTaskClick}
              selectedTaskId={selectedTaskId}
              renderTaskDetail={renderTaskDetail}
            />
          ))}
        </div>
      ) : null}

      {view === "month" ? (
        <div className="space-y-2">
          {[...monthTasks]
            .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)))
            .map((task) => (
              <TaskScheduleRow
                key={task.id}
                task={task}
                users={users}
                onClick={onTaskClick}
                selected={selectedTaskId === task.id}
                renderTaskDetail={renderTaskDetail}
              />
            ))}
          {monthTasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No tasks this month</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TaskListTable({
  tasks,
  users,
  companies,
  onTaskClick,
  selectedTaskId,
  renderTaskDetail,
  entityLinkTarget = "company",
}: {
  tasks: FollowUpTask[];
  users: User[];
  companies: { id: string; name: string }[];
  onTaskClick?: (task: FollowUpTask) => void;
  selectedTaskId?: string;
  renderTaskDetail?: (task: FollowUpTask) => ReactNode;
  entityLinkTarget?: "company" | "crm";
}) {
  return (
    <DataTable
      data={tasks}
      hideSearch
      pageSize={20}
      density="compact"
      getRowId={(t) => t.id}
      onRowClick={onTaskClick}
      expandedRowId={selectedTaskId ?? null}
      renderExpandedRow={renderTaskDetail}
      columns={[
        {
          key: "title",
          header: "Task",
          render: (task) => (
            <div>
              <div className="font-medium">{task.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {companies.find((c) => c.id === task.companyId)?.name ?? "—"}
              </div>
            </div>
          ),
        },
        {
          key: "taskType",
          header: "Type",
          render: (task) => (
            <span className="text-xs">
              {task.taskType ? FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType] : "—"}
            </span>
          ),
        },
        {
          key: "schedule",
          header: "Date / time",
          render: (task) => (
            <div className="text-xs">
              <div>{task.dueDate ? formatDate(task.dueDate) : "—"}</div>
              <div className="text-muted-foreground">
                {formatTimeRange12h(task.startTime, task.endTime)}
              </div>
            </div>
          ),
        },
        {
          key: "duration",
          header: "Duration",
          render: (task) => (
            <span className="text-xs tabular-nums">
              {formatDurationMinutes(resolveTaskDurationMinutes(task))}
            </span>
          ),
        },
        {
          key: "assignee",
          header: "Assignee",
          render: (task) => {
            const ids = task.assigneeUserIds?.length
              ? task.assigneeUserIds
              : task.assigneeUserId
                ? [task.assigneeUserId]
                : [];
            return (
              <span className="text-xs">
                {ids.length
                  ? ids.map((id) => resolveAssigneeLabel(id, users)).join(", ")
                  : "—"}
              </span>
            );
          },
        },
        {
          key: "status",
          header: "Status",
          render: (task) => <Pill tone={statusTone(task.status)}>{task.status}</Pill>,
        },
        {
          key: "source",
          header: "Source",
          render: (task) => (
            <span className="text-xs capitalize">{task.source ?? "manual"}</span>
          ),
        },
        {
          key: "company",
          header: "Account",
          render: (task) => (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[10px]"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              {entityLinkTarget === "crm" ? (
                <Link
                  to="/crm/accounts/$accountId"
                  params={{ accountId: task.companyId }}
                  search={{ tab: "tasks" }}
                >
                  <Building2 className="h-3 w-3" />
                  Account
                </Link>
              ) : (
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: task.companyId }}
                  search={{ tab: "Tasks" }}
                >
                  <Building2 className="h-3 w-3" />
                  Account
                </Link>
              )}
            </Button>
          ),
        },
      ]}
    />
  );
}

function ScheduleDayColumn({
  date,
  tasks,
  users,
  compact,
  onTaskClick,
  selectedTaskId,
  renderTaskDetail,
}: {
  date: string;
  tasks: FollowUpTask[];
  users: User[];
  compact?: boolean;
  onTaskClick?: (task: FollowUpTask) => void;
  selectedTaskId?: string;
  renderTaskDetail?: (task: FollowUpTask) => ReactNode;
}) {
  const isToday = date === new Date().toISOString().slice(0, 10);
  return (
    <div className={cn("card-soft min-h-[8rem] p-2", isToday && "ring-1 ring-primary/30")}>
      <div className={cn("mb-2 font-medium", compact ? "text-[10px]" : "text-xs")}>
        {formatDate(date)}
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <TaskScheduleRow
            key={task.id}
            task={task}
            users={users}
            compact={compact}
            onClick={onTaskClick}
            selected={selectedTaskId === task.id}
            renderTaskDetail={renderTaskDetail}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No tasks</p>
        ) : null}
      </div>
    </div>
  );
}

function TaskScheduleRow({
  task,
  users,
  compact,
  onClick,
  selected = false,
  renderTaskDetail,
}: {
  task: FollowUpTask;
  users: User[];
  compact?: boolean;
  onClick?: (task: FollowUpTask) => void;
  selected?: boolean;
  renderTaskDetail?: (task: FollowUpTask) => ReactNode;
}) {
  const ids = task.assigneeUserIds?.length
    ? task.assigneeUserIds
    : task.assigneeUserId
      ? [task.assigneeUserId]
      : [];
  const assigneeLabel = ids.map((id) => resolveAssigneeLabel(id, users)).join(", ");

  return (
    <div className="space-y-0">
      <button
        type="button"
        className={cn(
          "w-full rounded-md border bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted/40",
          compact && "px-1.5 py-1",
          selected && "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/15",
        )}
        onClick={() => onClick?.(task)}
      >
        <div className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>{task.title}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatTimeRange12h(task.startTime, task.endTime)}
          {task.taskType ? ` · ${FOLLOW_UP_TASK_TYPE_LABEL[task.taskType]}` : ""}
        </div>
        {!compact ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <Pill tone={statusTone(task.status)}>{task.status.replace(/_/g, " ")}</Pill>
            {assigneeLabel ? (
              <span className="text-[10px] text-muted-foreground">{assigneeLabel}</span>
            ) : null}
            {task.source === "booking" ? (
              <span className="text-[10px] text-primary">Booking</span>
            ) : null}
          </div>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {selected && renderTaskDetail ? (
          <motion.div
            key={`${task.id}-detail`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1.5">{renderTaskDetail(task)}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
