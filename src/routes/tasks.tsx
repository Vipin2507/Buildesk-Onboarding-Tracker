import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { EntityFormModal } from "@/components/entity-form-modal";
import { DatePickerField } from "@/components/date-picker-field";
import {
  FOLLOW_UP_TASK_PRIORITIES,
  FOLLOW_UP_TASK_STATUSES,
  type FollowUpTaskPriority,
  type FollowUpTaskStatus,
} from "@/types";
import { useCompanyStore, useTaskStore, useUserStore } from "@/stores";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can("manageTasks");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState<FollowUpTaskStatus>("open");
  const [priority, setPriority] = useState<FollowUpTaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const assignees = assignableManagerUsers(users);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks
      .filter((t) => {
        if (statusFilter === "overdue") {
          if (!["open", "in_progress", "blocked"].includes(t.status) || !t.dueDate || t.dueDate >= today) {
            return false;
          }
        } else if (statusFilter === "due_today") {
          if (t.dueDate !== today) return false;
        } else if (statusFilter !== "all" && t.status !== statusFilter) {
          return false;
        }
        if (companyFilter !== "all" && t.companyId !== companyFilter) return false;
        if (!q) return true;
        const companyName = companies.find((c) => c.id === t.companyId)?.name ?? "";
        return (
          t.title.toLowerCase().includes(q) ||
          companyName.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tasks, search, statusFilter, companyFilter, companies, today]);

  const overdue = tasks.filter(
    (t) =>
      ["open", "in_progress", "blocked"].includes(t.status) && t.dueDate && t.dueDate < today,
  ).length;

  function submit() {
    if (!title.trim() || !companyId) {
      toast.error("Title and company are required");
      return;
    }
    addTask({
      companyId,
      title: title.trim(),
      status,
      priority,
      progressPercent: 0,
      dueDate: dueDate || undefined,
      assigneeUserId: assigneeUserId || undefined,
    });
    toast.success("Task created");
    setOpen(false);
    setTitle("");
    setCompanyId("");
    setDueDate("");
    setAssigneeUserId("");
  }

  return (
    <PageWrap>
      <PageHeader
        title="Follow-up Tasks"
        subtitle={`${filtered.length} shown · ${overdue} overdue`}
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add task
            </Button>
          ) : null
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks or companies…"
        resultCount={filtered.length}
        resultLabel="tasks"
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "overdue", label: "Overdue" },
              { value: "due_today", label: "Due today" },
              ...FOLLOW_UP_TASK_STATUSES.map((s) => ({ value: s, label: s })),
            ],
          },
          {
            id: "company",
            label: "Company",
            value: companyFilter,
            onChange: setCompanyFilter,
            options: [
              { value: "all", label: "All companies" },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
        ]}
      />

      <DataTable
        data={filtered}
        hideSearch
        getRowId={(t) => t.id}
        columns={[
          {
            key: "title",
            header: "Task",
            render: (t) => (
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {companies.find((c) => c.id === t.companyId)?.name ?? "—"}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (t) => <Pill>{t.status}</Pill>,
          },
          {
            key: "priority",
            header: "Priority",
            render: (t) => <Pill tone={t.priority === "urgent" ? "warning" : "muted"}>{t.priority}</Pill>,
          },
          {
            key: "assignee",
            header: "Assignee",
            render: (t) => resolveAssigneeLabel(t.assigneeUserId, users),
          },
          {
            key: "dueDate",
            header: "Due",
            render: (t) => (t.dueDate ? formatDate(t.dueDate) : "—"),
          },
          {
            key: "progress",
            header: "Progress",
            render: (t) => (
              <div className="flex min-w-28 items-center gap-2">
                <ProgressBar value={t.progressPercent} className="flex-1" />
                <span className="text-xs">{t.progressPercent}%</span>
              </div>
            ),
          },
          {
            key: "company",
            header: "",
            render: (t) => (
              <Button size="sm" variant="outline" asChild>
                <Link to="/companies/$companyId" params={{ companyId: t.companyId }} search={{ tab: "Tasks" }}>
                  Open
                </Link>
              </Button>
            ),
          },
        ]}
      />

      <EntityFormModal
        open={open}
        onOpenChange={setOpen}
        title="Create follow-up task"
        submitLabel="Create"
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
            Company
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
