import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import {
  TaskFormFields,
  useTaskFormState,
} from "@/components/tasks/task-form-fields";
import { resolveDefaultTaskAssigneeIds, taskAssigneeUserOptions } from "@/lib/task-defaults";
import { formatTimeRange12h } from "@/lib/task-scheduling";
import { useTaskTimeStatusSync, useTasksWithTimeStatus } from "@/hooks/use-task-time-status";
import { resolveAssigneeLabel } from "@/lib/managers";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useCompanyStore, useTaskStore, useUserStore } from "@/stores";
import { FOLLOW_UP_TASK_TYPE_LABEL, type FollowUpTask, type FollowUpTaskType } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";

export function CompanyTasksPanel({ companyId }: { companyId: string }) {
  const tasks = useTaskStore((s) => s.tasks);
  useTaskTimeStatusSync(true);
  const timeAwareTasks = useTasksWithTimeStatus(tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const company = useCompanyStore((s) => s.getById(companyId));
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageTasks");

  const companyTasks = useMemo(
    () =>
      timeAwareTasks
        .filter((t) => t.companyId === companyId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [timeAwareTasks, companyId],
  );

  const assignees = useMemo(
    () => taskAssigneeUserOptions({ users, company }),
    [users, company],
  );
  const defaultAssigneeIds = useMemo(
    () => resolveDefaultTaskAssigneeIds({ company, users }),
    [company, users],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [remark, setRemark] = useState("");
  const [markCompleteOnCreate, setMarkCompleteOnCreate] = useState(false);

  const form = useTaskFormState({
    users: assignees,
    defaultAssigneeIds,
    editing,
    companyId,
  });

  const openCount = companyTasks.filter((t) =>
    ["open", "in_progress", "blocked"].includes(t.status),
  ).length;
  const overdueCount = companyTasks.filter(
    (t) =>
      ["open", "in_progress", "blocked"].includes(t.status) &&
      t.dueDate &&
      t.dueDate < new Date().toISOString().slice(0, 10),
  ).length;

  function openCreate() {
    setEditing(null);
    form.reset();
    setRemark("");
    setMarkCompleteOnCreate(false);
    setOpen(true);
  }

  function openEdit(task: FollowUpTask) {
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
      companyId,
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">Tasks</h3>
          <p className="text-[10px] text-muted-foreground">
            {openCount} open · {overdueCount} overdue · {companyTasks.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/tasks" className="text-[10px] font-medium text-primary hover:underline">
            Task calendar
          </Link>
          {canManage ? (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={openCreate}>
              <Plus className="h-3 w-3" /> Add task
            </Button>
          ) : null}
        </div>
      </div>

      {companyTasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create tasks for client follow-ups, calls, and site visits."
          actionLabel={canManage ? "+ Add task" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-1.5">
          {companyTasks.map((task) => {
            const ids = task.assigneeUserIds?.length
              ? task.assigneeUserIds
              : task.assigneeUserId
                ? [task.assigneeUserId]
                : [];
            return (
              <button
                key={task.id}
                type="button"
                className="card-soft flex w-full flex-col gap-1.5 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                onClick={() => canManage && openEdit(task)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{task.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ids.map((id) => resolveAssigneeLabel(id, users)).join(", ") || "Unassigned"} ·{" "}
                      {formatTimeRange12h(task.startTime, task.endTime)} · Due{" "}
                      {task.dueDate ? formatDate(task.dueDate) : "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {task.taskType ? (
                      <Pill tone="muted">{FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType]}</Pill>
                    ) : null}
                    <Pill tone={task.status === "completed" ? "success" : "muted"}>{task.status}</Pill>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Update task" : "Create task"}
        submitLabel={editing ? "Save" : "Create"}
        onSubmit={submit}
      >
        <TaskFormFields
          {...form}
          users={assignees}
          defaultAssigneeIds={defaultAssigneeIds}
          editing={editing}
          markCompleteOnCreate={markCompleteOnCreate}
          onMarkCompleteOnCreateChange={setMarkCompleteOnCreate}
        />
        {editing ? (
          <div className="mt-4 space-y-2 border-t pt-3">
            {editing.completedAt ? (
              <p className="text-xs text-muted-foreground">
                Completed {formatDateTime(editing.completedAt)}
              </p>
            ) : null}
            <textarea
              className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional remark for history"
            />
            {editing.status !== "completed" && editing.status !== "cancelled" ? (
              <Button type="button" variant="outline" className="w-full gap-1" onClick={() => {
                completeTask(editing.id, remark.trim() || undefined);
                toast.success("Task marked complete");
                setOpen(false);
              }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as complete
              </Button>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </div>
  );
}
