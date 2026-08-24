import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import {
  DesignTicketSection,
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { DatePickerField } from "@/components/date-picker-field";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ListToolbar } from "@/components/list-toolbar";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  canManageCrmAccountTasks,
  crmAccountTeamAssigneeUsers,
} from "@/lib/crm-account-access";
import { cn, formatDate } from "@/lib/utils";
import { resolveAssigneeLabel } from "@/lib/managers";
import { useAuthStore, useCrmAccountStore, useTaskStore, useUserStore } from "@/stores";
import {
  FOLLOW_UP_TASK_PRIORITIES,
  FOLLOW_UP_TASK_STATUSES,
  type FollowUpTask,
  type FollowUpTaskPriority,
  type FollowUpTaskStatus,
} from "@/types";

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[72px] text-xs");

const OPEN_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

function statusTone(status: FollowUpTaskStatus): "success" | "warning" | "danger" | "muted" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "blocked") return "warning";
  return "muted";
}

function priorityTone(priority: FollowUpTaskPriority): "success" | "warning" | "danger" | "muted" {
  if (priority === "urgent" || priority === "high") return "warning";
  return "muted";
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
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const cancelTask = useTaskStore((s) => s.cancelTask);
  const users = useUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);

  const canManage = account ? canManageCrmAccountTasks(account, currentUser) : false;

  const accountTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.companyId === accountId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tasks, accountId],
  );

  const assignees = useMemo(() => {
    if (!account) return [];
    const team = crmAccountTeamAssigneeUsers(account, users);
    return team.length > 0
      ? team
      : users.filter((u) => u.active && (u.productScope === "crm" || !u.productScope || u.role === "Admin"));
  }, [account, users]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FollowUpTaskStatus>("open");
  const [priority, setPriority] = useState<FollowUpTaskPriority>("medium");
  const [progressPercent, setProgressPercent] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [remark, setRemark] = useState("");

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
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && task.assigneeUserId !== assigneeFilter) return false;
      if (q) {
        const hay = [
          task.title,
          task.description ?? "",
          resolveAssigneeLabel(task.assigneeUserId, users),
          task.status,
          task.priority,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accountTasks, statusFilter, priorityFilter, assigneeFilter, query, users]);

  const assigneeOptions = useMemo(
    () => [
      { value: "all", label: "All assignees" },
      ...assignees.map((u) => ({ value: u.id, label: u.name })),
    ],
    [assignees],
  );

  function resetForm() {
    setTitle("");
    setDescription("");
    setStatus("open");
    setPriority("medium");
    setProgressPercent(0);
    setDueDate("");
    setAssigneeUserId("");
    setRemark("");
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(task: FollowUpTask) {
    if (!canManage) return;
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setProgressPercent(task.progressPercent);
    setDueDate(task.dueDate ?? "");
    setAssigneeUserId(task.assigneeUserId ?? "");
    setRemark("");
    setOpen(true);
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editing) {
      updateTask(editing.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        progressPercent,
        dueDate: dueDate || undefined,
        assigneeUserId: assigneeUserId || undefined,
        remark: remark.trim() || undefined,
      });
      toast.success("Task updated");
    } else {
      addTask({
        companyId: accountId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        progressPercent,
        dueDate: dueDate || undefined,
        assigneeUserId: assigneeUserId || undefined,
      });
      toast.success("Task created");
    }
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
    priorityFilter !== "all",
    assigneeFilter !== "all",
  ].filter(Boolean).length;

  const content = (
    <>
      {!compact ? (
        <ListToolbar
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search tasks, assignee, or notes…"
          selects={[
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              options: [
                { value: "all", label: "All statuses" },
                ...FOLLOW_UP_TASK_STATUSES.map((s) => ({
                  value: s,
                  label: formatStatusLabel(s),
                })),
              ],
              onChange: setStatusFilter,
            },
            {
              id: "priority",
              label: "Priority",
              value: priorityFilter,
              options: [
                { value: "all", label: "All priorities" },
                ...FOLLOW_UP_TASK_PRIORITIES.map((p) => ({ value: p, label: p })),
              ],
              onChange: setPriorityFilter,
            },
            {
              id: "assignee",
              label: "Assignee",
              value: assigneeFilter,
              options: assigneeOptions,
              onChange: setAssigneeFilter,
            },
          ]}
          resultCount={filtered.length}
          resultLabel="tasks"
          activeFilterCount={activeFilterCount}
          onClear={() => {
            setQuery("");
            setStatusFilter("all");
            setPriorityFilter("all");
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
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{task.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {resolveAssigneeLabel(task.assigneeUserId, users)} · Due{" "}
                      {task.dueDate ? formatDate(task.dueDate) : "—"}
                    </div>
                  </div>
                  <Pill tone={statusTone(task.status)}>{formatStatusLabel(task.status)}</Pill>
                </div>
              </>
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
                </div>
              ),
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
              key: "priority",
              header: "Priority",
              sortable: true,
              render: (task) => (
                <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
              ),
            },
            {
              key: "assigneeUserId",
              header: "Assignee",
              sortable: true,
              render: (task) => (
                <span className="text-xs">
                  {resolveAssigneeLabel(task.assigneeUserId, users)}
                </span>
              ),
            },
            {
              key: "dueDate",
              header: "Due",
              sortable: true,
              render: (task) => (
                <span className="text-xs text-muted-foreground">
                  {task.dueDate ? formatDate(task.dueDate) : "—"}
                </span>
              ),
            },
            {
              key: "progressPercent",
              header: "Progress",
              sortable: true,
              render: (task) => (
                <div className="flex min-w-[5rem] items-center gap-2">
                  <ProgressBar value={task.progressPercent} className="flex-1" />
                  <span className="text-[10px] tabular-nums">{task.progressPercent}%</span>
                </div>
              ),
            },
            {
              key: "updatedAt",
              header: "Updated",
              sortable: true,
              render: (task) => (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(task.updatedAt)}
                </span>
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
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Title
            <input
              className={cn(fieldClass, "mt-1 w-full")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow-up action…"
            />
          </label>
          <label className="block text-xs font-medium">
            Description
            <textarea
              className={cn(areaClass, "mt-1 w-full")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, next steps, client notes…"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">
              Status
              <select
                className={cn(selectClass, "mt-1 w-full")}
                value={status}
                onChange={(e) => setStatus(e.target.value as FollowUpTaskStatus)}
              >
                {FOLLOW_UP_TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Priority
              <select
                className={cn(selectClass, "mt-1 w-full")}
                value={priority}
                onChange={(e) => setPriority(e.target.value as FollowUpTaskPriority)}
              >
                {FOLLOW_UP_TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium">
            Progress ({progressPercent}%)
            <input
              type="range"
              min={0}
              max={100}
              className="mt-2 w-full"
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
            />
          </label>
          <label className="block text-xs font-medium">
            Due date
            <div className="mt-1">
              <DatePickerField value={dueDate} onChange={setDueDate} modal yearsBack={1} yearsForward={3} />
            </div>
          </label>
          <label className="block text-xs font-medium">
            Assignee
            <select
              className={cn(selectClass, "mt-1 w-full")}
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {editing ? (
            <>
              <label className="block text-xs font-medium">
                Remark (appended to history)
                <textarea
                  className={cn(areaClass, "mt-1 w-full")}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional progress note"
                />
              </label>
              {editing.status !== "cancelled" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1 text-destructive"
                  onClick={handleCancelTask}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel task
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
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
        </div>
      }
    >
      {content}
    </DesignTicketSection>
  );
}
