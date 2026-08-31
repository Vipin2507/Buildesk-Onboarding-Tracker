import {
  AlertCircle,
  Ban,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutList,
  Plus,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketTabNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { ListToolbar } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  TaskCalendarPanel,
  type TaskCalendarView,
} from "@/components/tasks/task-calendar-panel";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import {
  TaskFormFields,
  useTaskFormState,
} from "@/components/tasks/task-form-fields";
import { erpTaskAssigneeUserOptions, resolveDefaultTaskAssigneeIds } from "@/lib/task-defaults";
import { resolveTaskAssigneeIds } from "@/lib/task-scheduling";
import { useTaskTimeStatusSync, useTasksWithTimeStatus } from "@/hooks/use-task-time-status";
import { useAuthStore, useCompanyStore, useErpTaskStore, useUserStore } from "@/stores";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
} from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import type { ErpTasksTabId } from "@/lib/erp-route-search";
import { motion } from "framer-motion";

const OPEN_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

const TASK_TABS = [
  { id: "all", label: "All tasks", icon: LayoutList },
  { id: "my", label: "My tasks", icon: UserIcon },
  { id: "open", label: "Open", icon: Clock },
  { id: "today", label: "Due today", icon: CalendarDays },
  { id: "overdue", label: "Overdue", icon: AlertCircle },
  { id: "list", label: "List view", icon: LayoutList },
  { id: "day", label: "Day", icon: Clock },
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "month", label: "Month", icon: Calendar },
] as const;

function isCalendarTab(tab: ErpTasksTabId): tab is TaskCalendarView {
  return tab === "list" || tab === "day" || tab === "week" || tab === "month";
}

type Props = {
  tab: ErpTasksTabId;
  onTabChange: (tab: ErpTasksTabId) => void;
  selectedTaskId?: string;
  onSelectTask: (taskId: string | undefined) => void;
};

export function ErpTasksHub({ tab, onTabChange, selectedTaskId, onSelectTask }: Props) {
  const tasks = useErpTaskStore((s) => s.tasks);
  useTaskTimeStatusSync(true, "erp");
  const timeAwareTasks = useTasksWithTimeStatus(tasks);
  const addTask = useErpTaskStore((s) => s.addTask);
  const updateTask = useErpTaskStore((s) => s.updateTask);
  const completeTask = useErpTaskStore((s) => s.completeTask);
  const cancelTask = useErpTaskStore((s) => s.cancelTask);
  const deleteTask = useErpTaskStore((s) => s.deleteTask);
  const companies = useCompanyStore((s) => s.companies);
  const users = useUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);
  const { can, isAdmin } = usePermissions();

  const companyOptions = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies],
  );

  const erpTasks = timeAwareTasks;

  const today = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const open = erpTasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
    const dueToday = erpTasks.filter(
      (t) => OPEN_STATUSES.includes(t.status) && t.dueDate === today,
    ).length;
    const overdue = erpTasks.filter(
      (t) => OPEN_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today,
    ).length;
    const myOpen = erpTasks.filter((t) => {
      if (!OPEN_STATUSES.includes(t.status) || !currentUser?.id) return false;
      return resolveTaskAssigneeIds(t).includes(currentUser.id);
    }).length;
    return { open, dueToday, overdue, myOpen, total: erpTasks.length };
  }, [erpTasks, today, currentUser?.id]);

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "my":
        return erpTasks.filter((t) =>
          currentUser?.id ? resolveTaskAssigneeIds(t).includes(currentUser.id) : false,
        );
      case "open":
        return erpTasks.filter((t) => OPEN_STATUSES.includes(t.status));
      case "today":
        return erpTasks.filter((t) => OPEN_STATUSES.includes(t.status) && t.dueDate === today);
      case "overdue":
        return erpTasks.filter(
          (t) => OPEN_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today,
        );
      default:
        return erpTasks;
    }
  }, [erpTasks, tab, today, currentUser?.id]);

  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabFiltered.filter((task) => {
      if (companyFilter !== "all" && task.companyId !== companyFilter) return false;
      if (typeFilter !== "all" && task.taskType !== typeFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && !resolveTaskAssigneeIds(task).includes(assigneeFilter)) {
        return false;
      }
      if (!q) return true;
      const companyName = companyOptions.find((a) => a.id === task.companyId)?.name ?? "";
      return (
        task.title.toLowerCase().includes(q) ||
        companyName.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tabFiltered, query, companyFilter, typeFilter, statusFilter, assigneeFilter, companyOptions]);

  const selectedTask = selectedTaskId ? erpTasks.find((t) => t.id === selectedTaskId) : undefined;
  const editingCompany = selectedTask
    ? companies.find((c) => c.id === selectedTask.companyId)
    : undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [createCompanyId, setCreateCompanyId] = useState("");
  const [remark, setRemark] = useState("");
  const [markCompleteOnCreate, setMarkCompleteOnCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpTask | null>(null);

  const createCompany = companies.find((c) => c.id === createCompanyId);
  const assignees = useMemo(
    () =>
      erpTaskAssigneeUserOptions({
        users,
        company: createCompany,
      }),
    [createCompany, users],
  );

  const defaultAssigneeIds = useMemo(
    () => resolveDefaultTaskAssigneeIds({ company: createCompany, users }),
    [createCompany, users],
  );

  const form = useTaskFormState({
    users: assignees,
    defaultAssigneeIds,
    editing,
    companyId: createCompanyId,
    markCompleteOnCreate,
  });

  const canManage = isAdmin || can("manageTasks");

  function canManageTask(_task?: FollowUpTask) {
    return canManage;
  }

  const canCreate = canManage;

  function openCreate() {
    setEditing(null);
    setCreateCompanyId(companies[0]?.id ?? "");
    form.reset();
    setRemark("");
    setMarkCompleteOnCreate(false);
    setModalOpen(true);
  }

  function openEdit(task: FollowUpTask) {
    setEditing(task);
    setCreateCompanyId(task.companyId);
    setRemark("");
    setModalOpen(true);
    onSelectTask(task.id);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const companyId = createCompanyId || editing?.companyId;
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
    setModalOpen(false);
  }

  const calendarView: TaskCalendarView = isCalendarTab(tab) ? tab : "list";
  const activeFilterCount = [
    companyFilter !== "all",
    typeFilter !== "all",
    statusFilter !== "all",
    assigneeFilter !== "all",
  ].filter(Boolean).length;

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const task of erpTasks) {
      for (const id of resolveTaskAssigneeIds(task)) ids.add(id);
    }
    return [
      { value: "all", label: "All assignees" },
      ...users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.name })),
    ];
  }, [erpTasks, users]);

  function toggleTaskSelection(task: FollowUpTask) {
    onSelectTask(selectedTaskId === task.id ? undefined : task.id);
  }

  function renderTaskDetail(task: FollowUpTask) {
    return (
      <TaskDetailPanel
        embedded
        task={task}
        accountName={companyOptions.find((a) => a.id === task.companyId)?.name ?? "—"}
        users={users}
        canManage={canManageTask(task)}
        canDeleteAdmin={isAdmin}
        onEdit={() => openEdit(task)}
        onComplete={() => {
          completeTask(task.id);
          toast.success("Task marked complete");
          onSelectTask(undefined);
        }}
        onCancel={() => {
          cancelTask(task.id);
          toast.success("Task cancelled");
          onSelectTask(undefined);
        }}
        onDelete={isAdmin ? () => setDeleteTarget(task) : undefined}
        onClose={() => onSelectTask(undefined)}
        onAddRemark={
          canManageTask(task)
            ? (remark) => {
                updateTask(task.id, { remark });
                toast.success("Remark added");
              }
            : undefined
        }
        onAdjustExtraTime={
          canManageTask(task)
            ? (delta) => {
                const next = Math.max(0, (task.extraTimeMinutes ?? 0) + delta);
                updateTask(task.id, { extraTimeMinutes: next });
                if (delta > 0) toast.success(`Added ${delta} min extra time`);
                else if (delta < 0 && next === 0) toast.success("Extra time cleared");
                else if (delta < 0) toast.success(`Removed ${Math.abs(delta)} min extra time`);
              }
            : undefined
        }
      />
    );
  }

  return (
    <PageWrap>
      <DesignTicketPageHeader
        title="Tasks"
        subtitle="Schedule, assign, and track follow-ups across ERP companies"
        actions={
          canCreate ? (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create task
            </Button>
          ) : null
        }
      />

      <DesignTicketKpiGrid
        size="compact"
        columns={5}
        items={[
          {
            id: "open",
            label: "Open",
            value: kpis.open,
            icon: Clock,
            active: tab === "open",
            onClick: () => onTabChange("open"),
          },
          {
            id: "my",
            label: "My tasks",
            value: kpis.myOpen,
            icon: UserIcon,
            active: tab === "my",
            onClick: () => onTabChange("my"),
          },
          {
            id: "today",
            label: "Due today",
            value: kpis.dueToday,
            icon: CalendarDays,
            active: tab === "today",
            onClick: () => onTabChange("today"),
          },
          {
            id: "overdue",
            label: "Overdue",
            value: kpis.overdue,
            icon: AlertCircle,
            tone: kpis.overdue > 0 ? "text-destructive" : undefined,
            active: tab === "overdue",
            onClick: () => onTabChange("overdue"),
          },
          {
            id: "all",
            label: "Total",
            value: kpis.total,
            icon: LayoutList,
            active: tab === "all",
            onClick: () => onTabChange("all"),
          },
        ]}
      />

      <DesignTicketTabNav
        compact
        tabs={[...TASK_TABS]}
        activeId={tab}
        onChange={(id) => onTabChange(id as ErpTasksTabId)}
      />

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show" className="space-y-2.5">
        {!isCalendarTab(tab) ? (
          <ListToolbar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search tasks, companies, descriptions…"
            resultCount={filtered.length}
            resultLabel="tasks"
            activeFilterCount={activeFilterCount}
            onClear={() => {
              setQuery("");
              setCompanyFilter("all");
              setTypeFilter("all");
              setStatusFilter("all");
              setAssigneeFilter("all");
            }}
            selects={[
              {
                id: "company",
                label: "Company",
                value: companyFilter,
                onChange: setCompanyFilter,
                options: [
                  { value: "all", label: "All companies" },
                  ...companyOptions.map((a) => ({ value: a.id, label: a.name })),
                ],
              },
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
              {
                id: "assignee",
                label: "Assignee",
                value: assigneeFilter,
                onChange: setAssigneeFilter,
                options: assigneeOptions,
              },
            ]}
          />
        ) : null}

        <TaskCalendarPanel
          tasks={isCalendarTab(tab) ? tabFiltered : filtered}
          users={users}
          companies={companyOptions}
          view={calendarView}
          onViewChange={(v) => onTabChange(v)}
          onTaskClick={toggleTaskSelection}
          selectedTaskId={selectedTaskId}
          renderTaskDetail={renderTaskDetail}
          canManage={canCreate}
          embedded={!isCalendarTab(tab)}
          hideViewToggle
          entityLinkTarget="company"
        />
      </motion.div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Update task" : "Create task"}
        submitLabel={editing ? "Save task" : "Create task"}
        onSubmit={submit}
      >
        {!editing ? (
          <label className="mb-3 block text-xs font-medium">
            Company
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={createCompanyId}
              onChange={(e) => {
                setCreateCompanyId(e.target.value);
              }}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : editingCompany ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Company: <span className="font-medium text-foreground">{editingCompany.name}</span>
          </p>
        ) : null}

        <TaskFormFields
          {...form}
          users={assignees}
          defaultAssigneeIds={defaultAssigneeIds}
          editing={editing}
          markCompleteOnCreate={markCompleteOnCreate}
          onMarkCompleteOnCreateChange={setMarkCompleteOnCreate}
          productScope="erp"
        />

        {editing ? (
          <div className="mt-4 space-y-2 border-t pt-3">
            <textarea
              className="min-h-[56px] w-full rounded-md border px-3 py-2 text-xs"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional remark for history"
            />
            {editing.status !== "completed" && editing.status !== "cancelled" && canManageTask(editing) ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1"
                  onClick={() => {
                    completeTask(editing.id, remark.trim() || undefined);
                    toast.success("Task marked complete");
                    setModalOpen(false);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark as complete
                </Button>
                {editing.source !== "booking" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-1 text-destructive"
                    onClick={() => {
                      cancelTask(editing.id, remark.trim() || undefined);
                      toast.success("Task cancelled");
                      setModalOpen(false);
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel task
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(editing)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete task
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete task?"
        description={
          deleteTarget
            ? `Permanently remove “${deleteTarget.title}”. This cannot be undone.`
            : undefined
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteTask(deleteTarget.id);
          toast.success("Task deleted");
          if (selectedTaskId === deleteTarget.id) onSelectTask(undefined);
          if (editing?.id === deleteTarget.id) setModalOpen(false);
          setDeleteTarget(null);
        }}
      />
    </PageWrap>
  );
}
