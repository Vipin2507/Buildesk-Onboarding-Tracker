import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import {
  DesignTicketSection,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ListToolbar } from "@/components/list-toolbar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TaskRowRemark } from "@/components/tasks/task-detail-panel";
import {
  TaskFormFields,
  useTaskFormState,
} from "@/components/tasks/task-form-fields";
import {
  canManageCrmAccountTasks,
} from "@/lib/crm-account-access";
import { resolveDefaultTaskAssigneeIds, taskAssigneeUserOptions } from "@/lib/task-defaults";
import { formatTimeRange12h, formatTaskDurationDisplay } from "@/lib/task-scheduling";
import {
  taskStatusTone,
  useTaskTimeStatusSync,
  useTasksWithTimeStatus,
} from "@/hooks/use-task-time-status";
import { formatDate, formatDateTime } from "@/lib/utils";
import { resolveAssigneeLabel } from "@/lib/managers";
import { useAuthStore, useCrmAccountStore, useCrmTaskStore, useUserStore } from "@/stores";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
  type FollowUpTaskType,
} from "@/types";

const OPEN_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

function statusTone(status: FollowUpTaskStatus): "success" | "warning" | "danger" | "muted" | "info" {
  return taskStatusTone(status);
}

function formatStatusLabel(status: FollowUpTaskStatus) {
  return status.replace(/_/g, " ");
}

type Props = {
  accountId: string;
  compact?: boolean;
  onViewAll?: () => void;
};

export function CrmAccountTasksPanel({ accountId, compact = false, onViewAll }: Props) {
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const tasks = useCrmTaskStore((s) => s.tasks);
  useTaskTimeStatusSync(true, "crm");
  const timeAwareTasks = useTasksWithTimeStatus(tasks);
  const addTask = useCrmTaskStore((s) => s.addTask);
  const updateTask = useCrmTaskStore((s) => s.updateTask);
  const completeTask = useCrmTaskStore((s) => s.completeTask);
  const cancelTask = useCrmTaskStore((s) => s.cancelTask);
  const users = useUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);

  const canManage = account ? canManageCrmAccountTasks(account, currentUser) : false;

  const accountTasks = useMemo(
    () =>
      timeAwareTasks
        .filter((t) => t.companyId === accountId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [timeAwareTasks, accountId],
  );

  const assignees = useMemo(
    () =>
      taskAssigneeUserOptions({
        users,
        crmAccount: account,
      }),
    [account, users],
  );

  const defaultAssigneeIds = useMemo(
    () => resolveDefaultTaskAssigneeIds({ crmAccount: account, users }),
    [account, users],
  );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [remark, setRemark] = useState("");
  const [markCompleteOnCreate, setMarkCompleteOnCreate] = useState(false);

  const form = useTaskFormState({
    users: assignees,
    defaultAssigneeIds,
    editing,
    companyId: accountId,
  });

  const openCount = accountTasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const overdueCount = accountTasks.filter(
    (t) =>
      OPEN_STATUSES.includes(t.status) &&
      t.dueDate &&
      t.dueDate < new Date().toISOString().slice(0, 10),
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accountTasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (typeFilter !== "all" && task.taskType !== typeFilter) return false;
      if (assigneeFilter !== "all") {
        const ids = task.assigneeUserIds?.length
          ? task.assigneeUserIds
          : task.assigneeUserId
            ? [task.assigneeUserId]
            : [];
        if (!ids.includes(assigneeFilter)) return false;
      }
      if (q) {
        const hay = [task.title, task.description ?? "", task.status, task.taskType ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accountTasks, statusFilter, typeFilter, assigneeFilter, query]);

  function openCreate() {
    setEditing(null);
    form.reset();
    setRemark("");
    setMarkCompleteOnCreate(false);
    setOpen(true);
  }

  function openEdit(task: FollowUpTask) {
    if (!canManage) return;
    setEditing(task);
    setRemark("");
    setOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!(await form.validateSchedule())) return;

    const payload = {
      companyId: accountId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate || undefined,
      taskType: form.taskType || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      durationMinutes: form.durationMinutes || undefined,
      assigneeUserIds: form.assigneeUserIds,
      assigneeUserId: form.assigneeUserIds[0],
      status: editing?.status ?? ("open" as const),
      priority: editing?.priority ?? ("medium" as const),
      progressPercent: editing?.progressPercent ?? 0,
      remark: remark.trim() || undefined,
    };

    if (editing) {
      updateTask(editing.id, payload);
      toast.success("Task updated");
    } else if (markCompleteOnCreate) {
      addTask({
        ...payload,
        status: "completed",
        priority: "medium",
        progressPercent: 100,
      });
      toast.success("Task created and marked complete");
    } else {
      addTask({ ...payload, status: "open", priority: "medium", progressPercent: 0 });
      toast.success("Task created");
    }
    setOpen(false);
  }

  function handleComplete() {
    if (!editing) return;
    completeTask(editing.id, remark.trim() || undefined);
    toast.success("Task marked complete");
    setOpen(false);
  }

  function handleCancelTask() {
    if (!editing) return;
    cancelTask(editing.id, remark.trim() || undefined);
    toast.success("Task cancelled");
    setOpen(false);
  }

  const activeFilterCount = [
    statusFilter !== "all",
    typeFilter !== "all",
    assigneeFilter !== "all",
  ].filter(Boolean).length;

  const content = (
    <>
      {!compact ? (
        <ListToolbar
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search tasks…"
          selects={[
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              options: [
                { value: "all", label: "All statuses" },
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ],
              onChange: setStatusFilter,
            },
            {
              id: "type",
              label: "Task type",
              value: typeFilter,
              options: [
                { value: "all", label: "All types" },
                ...Object.entries(FOLLOW_UP_TASK_TYPE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                })),
              ],
              onChange: setTypeFilter,
            },
            {
              id: "assignee",
              label: "Assignee",
              value: assigneeFilter,
              options: [
                { value: "all", label: "All assignees" },
                ...assignees.map((u) => ({ value: u.id, label: u.name })),
              ],
              onChange: setAssigneeFilter,
            },
          ]}
          resultCount={filtered.length}
          resultLabel="tasks"
          activeFilterCount={activeFilterCount}
          onClear={() => {
            setQuery("");
            setStatusFilter("all");
            setTypeFilter("all");
            setAssigneeFilter("all");
          }}
          trailing={
            canManage ? (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Add task
              </Button>
            ) : null
          }
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description={
            canManage
              ? "Create follow-up tasks for this account — they appear on the CRM dashboard activity feed."
              : "No tasks have been assigned for this account yet."
          }
          actionLabel={canManage ? "+ Add task" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : compact ? (
        <div className="space-y-1.5">
          {filtered.slice(0, 5).map((task) => {
            const row = (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatTimeRange12h(task.startTime, task.endTime)} · Due{" "}
                    {task.dueDate ? formatDate(task.dueDate) : "—"}
                  </div>
                </div>
                <Pill tone={statusTone(task.status)}>{formatStatusLabel(task.status)}</Pill>
              </div>
            );
            return canManage ? (
              <button
                key={task.id}
                type="button"
                className="card-soft flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                onClick={() => openEdit(task)}
              >
                {row}
              </button>
            ) : (
              <div key={task.id} className="card-soft flex w-full flex-col gap-1 px-3 py-2">
                {row}
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          data={filtered}
          hideSearch
          pageSize={12}
          density="compact"
          initialSortKey="dueDate"
          initialSortDir="desc"
          getRowId={(row) => row.id}
          onRowClick={canManage ? openEdit : undefined}
          columns={[
            {
              key: "title",
              header: "Task",
              sortable: true,
              render: (task) => (
                <div className="min-w-[10rem]">
                  <div className="font-medium">{task.title}</div>
                  {task.description ? (
                    <div className="line-clamp-1 text-[10px] text-muted-foreground">
                      {task.description}
                    </div>
                  ) : null}
                  <TaskRowRemark task={task} />
                </div>
              ),
            },
            {
              key: "taskType",
              header: "Type",
              sortable: true,
              render: (task) => (
                <span className="text-xs">
                  {task.taskType ? FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType] : "—"}
                </span>
              ),
            },
            {
              key: "schedule",
              header: "Date / time",
              sortable: true,
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
              sortable: true,
              render: (task) => (
                <span className="text-xs tabular-nums">{formatTaskDurationDisplay(task)}</span>
              ),
            },
            {
              key: "assigneeUserId",
              header: "Assignee",
              sortable: true,
              render: (task) => {
                const ids = task.assigneeUserIds?.length
                  ? task.assigneeUserIds
                  : task.assigneeUserId
                    ? [task.assigneeUserId]
                    : [];
                return (
                  <span className="text-xs">
                    {ids.map((id) => resolveAssigneeLabel(id, users)).join(", ") || "—"}
                  </span>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              sortable: true,
              render: (task) => (
                <Pill tone={statusTone(task.status)}>{formatStatusLabel(task.status)}</Pill>
              ),
            },
            {
              key: "source",
              header: "Source",
              render: (task) => (
                <span className="text-xs capitalize">{task.source ?? "manual"}</span>
              ),
            },
          ]}
        />
      )}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Update task" : "Create task"}
        submitLabel={editing ? "Save task" : "Create task"}
        onSubmit={submit}
      >
        <TaskFormFields
          {...form}
          users={assignees}
          defaultAssigneeIds={defaultAssigneeIds}
          editing={editing}
          markCompleteOnCreate={markCompleteOnCreate}
          onMarkCompleteOnCreateChange={setMarkCompleteOnCreate}
          productScope="crm"
        />
        {editing ? (
          <div className="mt-4 space-y-2 border-t pt-3">
            {editing.completedAt ? (
              <p className="text-xs text-muted-foreground">
                Completed {formatDateTime(editing.completedAt)}
              </p>
            ) : null}
            <textarea
              className="min-h-[56px] w-full rounded-md border px-3 py-2 text-xs"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional remark for history"
            />
            {editing.status !== "completed" && editing.status !== "cancelled" ? (
              <>
                <Button type="button" variant="outline" className="w-full gap-1" onClick={handleComplete}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark as complete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1 text-destructive"
                  onClick={handleCancelTask}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel task
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </>
  );

  if (compact) {
    return (
      <DesignTicketSection
        compact
        title="Account tasks"
        action={
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {openCount} open · {overdueCount} overdue
          </span>
        }
      >
        {content}
        {accountTasks.length > 5 ? (
          <div className="mt-2 text-right">
            {onViewAll ? (
              <button
                type="button"
                className="text-[10px] font-medium text-primary hover:underline"
                onClick={onViewAll}
              >
                View all tasks
              </button>
            ) : (
              <Link
                to="/crm/accounts/$accountId"
                params={{ accountId }}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                View all tasks
              </Link>
            )}
          </div>
        ) : null}
      </DesignTicketSection>
    );
  }

  return (
    <DesignTicketSection
      compact
      title="Account tasks"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {openCount} open · {overdueCount} overdue · {accountTasks.length} total
          </span>
          <Link
            to="/crm"
            search={{ tab: "activity" }}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            View on dashboard
          </Link>
          <Link to="/crm/tasks" className="text-[10px] font-medium text-primary hover:underline">
            Task calendar
          </Link>
        </div>
      }
    >
      {content}
    </DesignTicketSection>
  );
}
