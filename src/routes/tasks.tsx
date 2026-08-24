import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import {
  TaskFormFields,
  useTaskFormState,
} from "@/components/tasks/task-form-fields";
import {
  TaskCalendarPanel,
  type TaskCalendarView,
} from "@/components/tasks/task-calendar-panel";
import { resolveDefaultTaskAssigneeIds } from "@/lib/task-defaults";
import { assignableManagerUsers } from "@/lib/managers";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useCompanyStore, useTaskStore, useUserStore } from "@/stores";
import type { FollowUpTask } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageTasks");

  const [view, setView] = useState<TaskCalendarView>("list");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const assignees = assignableManagerUsers(users);
  const defaultAssigneeIds = useMemo(() => {
    const company = companies.find((c) => c.id === selectedCompanyId);
    return resolveDefaultTaskAssigneeIds({ company, users: assignees });
  }, [companies, selectedCompanyId, assignees]);

  const form = useTaskFormState({
    users: assignees,
    defaultAssigneeIds,
    editing,
    showCompanyField: true,
    companyId: selectedCompanyId,
    onCompanyIdChange: setSelectedCompanyId,
    companies,
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(
    (t) =>
      ["open", "in_progress", "blocked"].includes(t.status) && t.dueDate && t.dueDate < today,
  ).length;

  function openCreate() {
    setEditing(null);
    form.reset();
    setSelectedCompanyId("");
    setOpen(true);
  }

  function openEdit(task: FollowUpTask) {
    if (!canManage) return;
    setEditing(task);
    setSelectedCompanyId(task.companyId);
    setOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const companyId = form.companyId || editing?.companyId;
    if (!companyId) {
      toast.error("Company is required");
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
      status: "open" as const,
      priority: "medium" as const,
      progressPercent: 0,
    };

    if (editing) {
      updateTask(editing.id, payload);
      toast.success("Task updated");
    } else {
      addTask(payload);
      toast.success("Task created");
    }
    setOpen(false);
  }

  function handleComplete() {
    if (!editing) return;
    completeTask(editing.id);
    toast.success("Task marked complete");
    setOpen(false);
  }

  return (
    <PageWrap>
      <PageHeader
        title="Tasks"
        subtitle={`Consolidated schedule · ${tasks.length} total · ${overdue} overdue`}
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create task
            </Button>
          ) : null
        }
      />

      <TaskCalendarPanel
        tasks={tasks}
        users={users}
        companies={companies}
        view={view}
        onViewChange={setView}
        onTaskClick={canManage ? openEdit : undefined}
        canManage={canManage}
      />

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Task details" : "Create task"}
        submitLabel={editing ? "Save task" : "Create task"}
        onSubmit={submit}
      >
        <TaskFormFields
          {...form}
          users={assignees}
          defaultAssigneeIds={defaultAssigneeIds}
          editing={editing}
          showCompanyField={!editing}
          companies={companies}
          onCompanyIdChange={setSelectedCompanyId}
        />
        {editing ? (
          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Pill tone={editing.status === "completed" ? "success" : "muted"}>{editing.status}</Pill>
              {editing.completedAt ? (
                <span className="text-muted-foreground">
                  Completed {formatDateTime(editing.completedAt)}
                </span>
              ) : null}
              <span className="text-muted-foreground capitalize">Source: {editing.source ?? "manual"}</span>
            </div>
            {editing.status !== "completed" && editing.status !== "cancelled" ? (
              <Button type="button" variant="outline" className="w-full gap-1" onClick={handleComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as complete
              </Button>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </PageWrap>
  );
}
