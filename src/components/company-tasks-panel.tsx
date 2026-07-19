import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import { Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import {
  FOLLOW_UP_TASK_PRIORITIES,
  FOLLOW_UP_TASK_STATUSES,
  type FollowUpTask,
  type FollowUpTaskPriority,
  type FollowUpTaskStatus,
} from "@/types";
import { useTaskStore, useUserStore } from "@/stores";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export function CompanyTasksPanel({ companyId }: { companyId: string }) {
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageTasks");

  const companyTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.companyId === companyId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tasks, companyId],
  );

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

  const assignees = assignableManagerUsers(users);
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
    setTitle("");
    setDescription("");
    setStatus("open");
    setPriority("medium");
    setProgressPercent(0);
    setDueDate("");
    setAssigneeUserId("");
    setRemark("");
    setOpen(true);
  }

  function openEdit(task: FollowUpTask) {
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
        companyId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        progressPercent,
        dueDate: dueDate || undefined,
        assigneeUserId: assigneeUserId || undefined,
      });
      toast.success("Follow-up task created");
    }
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Follow-up Tasks</h3>
          <p className="text-xs text-muted-foreground">
            {openCount} open · {overdueCount} overdue · {companyTasks.length} total
          </p>
        </div>
        {canManage ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        ) : null}
      </div>

      {companyTasks.length === 0 ? (
        <EmptyState
          title="No follow-up tasks yet"
          description="Create tasks for client follow-ups, reminders, and next actions."
          actionLabel={canManage ? "+ Add task" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-2">
          {companyTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="card-soft flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/30"
              onClick={() => canManage && openEdit(task)}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {resolveAssigneeLabel(task.assigneeUserId, users)} · Due{" "}
                    {task.dueDate ? formatDate(task.dueDate) : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Pill tone={task.status === "completed" ? "success" : "muted"}>{task.status}</Pill>
                  <Pill tone={task.priority === "urgent" || task.priority === "high" ? "warning" : "muted"}>
                    {task.priority}
                  </Pill>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar value={task.progressPercent} className="flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground">{task.progressPercent}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Update follow-up task" : "Create follow-up task"}
        submitLabel={editing ? "Save" : "Create"}
        onSubmit={submit}
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Title
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Description
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">
              Status
              <select
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as FollowUpTaskStatus)}
              >
                {FOLLOW_UP_TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Priority
              <select
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
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
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
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
            <label className="block text-xs font-medium">
              Remark (appended to history)
              <textarea
                className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional progress note"
              />
            </label>
          ) : null}
        </div>
      </EntityFormModal>
    </div>
  );
}
