import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutList,
  Link2,
  Plus,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketTabNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ListToolbar } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  TaskCalendarPanel,
  type TaskCalendarView,
} from "@/components/tasks/task-calendar-panel";
import {
  TaskFormFields,
  useTaskFormState,
} from "@/components/tasks/task-form-fields";
import {
  canManageCrmAccountTasks,
  filterCrmAccountsForUser,
} from "@/lib/crm-account-access";
import { resolveDefaultTaskAssigneeIds, taskAssigneeUserOptions } from "@/lib/task-defaults";
import { formatTimeRange12h, resolveTaskAssigneeIds } from "@/lib/task-scheduling";
import { resolveAssigneeLabel } from "@/lib/managers";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore, useCrmAccountStore, useTaskStore, useUserStore } from "@/stores";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
  type FollowUpTaskType,
  type User,
} from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import type { CrmTasksTabId } from "@/lib/crm-route-search";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const OPEN_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

const TASK_TABS = [
  { id: "all", label: "All tasks", icon: LayoutList },
  { id: "my", label: "My tasks", icon: UserIcon },
  { id: "open", label: "Open", icon: Clock },
  { id: "today", label: "Due today", icon: CalendarDays },
  { id: "overdue", label: "Overdue", icon: AlertCircle },
  { id: "list", label: "List view", icon: LayoutList },
  { id: "day", label: "Day", icon: Calendar },
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "month", label: "Month", icon: Calendar },
] as const;

function statusTone(status: FollowUpTaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "blocked") return "warning" as const;
  return "muted" as const;
}

function isCalendarTab(tab: CrmTasksTabId): tab is TaskCalendarView {
  return tab === "list" || tab === "day" || tab === "week" || tab === "month";
}

type Props = {
  tab: CrmTasksTabId;
  onTabChange: (tab: CrmTasksTabId) => void;
  selectedTaskId?: string;
  onSelectTask: (taskId: string | undefined) => void;
};

export function CrmTasksHub({ tab, onTabChange, selectedTaskId, onSelectTask }: Props) {
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const cancelTask = useTaskStore((s) => s.cancelTask);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const users = useUserStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.user);
  const { can, isAdmin } = usePermissions();

  const visibleAccounts = useMemo(
    () => filterCrmAccountsForUser(accounts, currentUser),
    [accounts, currentUser],
  );
  const accountIds = useMemo(() => new Set(visibleAccounts.map((a) => a.id)), [visibleAccounts]);
  const accountOptions = useMemo(
    () => visibleAccounts.map((a) => ({ id: a.id, name: a.name })),
    [visibleAccounts],
  );

  const crmTasks = useMemo(
    () => tasks.filter((t) => accountIds.has(t.companyId)),
    [tasks, accountIds],
  );

  const today = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const open = crmTasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
    const dueToday = crmTasks.filter(
      (t) => OPEN_STATUSES.includes(t.status) && t.dueDate === today,
    ).length;
    const overdue = crmTasks.filter(
      (t) => OPEN_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today,
    ).length;
    const fromBooking = crmTasks.filter((t) => t.source === "booking" && OPEN_STATUSES.includes(t.status)).length;
    const myOpen = crmTasks.filter((t) => {
      if (!OPEN_STATUSES.includes(t.status) || !currentUser?.id) return false;
      return resolveTaskAssigneeIds(t).includes(currentUser.id);
    }).length;
    return { open, dueToday, overdue, fromBooking, myOpen, total: crmTasks.length };
  }, [crmTasks, today, currentUser?.id]);

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "my":
        return crmTasks.filter((t) =>
          currentUser?.id ? resolveTaskAssigneeIds(t).includes(currentUser.id) : false,
        );
      case "open":
        return crmTasks.filter((t) => OPEN_STATUSES.includes(t.status));
      case "today":
        return crmTasks.filter((t) => OPEN_STATUSES.includes(t.status) && t.dueDate === today);
      case "overdue":
        return crmTasks.filter(
          (t) => OPEN_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today,
        );
      default:
        return crmTasks;
    }
  }, [crmTasks, tab, today, currentUser?.id]);

  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabFiltered.filter((task) => {
      if (accountFilter !== "all" && task.companyId !== accountFilter) return false;
      if (typeFilter !== "all" && task.taskType !== typeFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (sourceFilter !== "all" && (task.source ?? "manual") !== sourceFilter) return false;
      if (assigneeFilter !== "all" && !resolveTaskAssigneeIds(task).includes(assigneeFilter)) {
        return false;
      }
      if (!q) return true;
      const accountName = accountOptions.find((a) => a.id === task.companyId)?.name ?? "";
      return (
        task.title.toLowerCase().includes(q) ||
        accountName.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tabFiltered, query, accountFilter, typeFilter, statusFilter, assigneeFilter, sourceFilter, accountOptions]);

  const selectedTask = selectedTaskId ? crmTasks.find((t) => t.id === selectedTaskId) : undefined;
  const editingAccount = selectedTask
    ? visibleAccounts.find((a) => a.id === selectedTask.companyId)
    : undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [createAccountId, setCreateAccountId] = useState("");
  const [remark, setRemark] = useState("");
  const [markCompleteOnCreate, setMarkCompleteOnCreate] = useState(false);

  const createAccount = visibleAccounts.find((a) => a.id === createAccountId);
  const assignees = useMemo(
    () =>
      taskAssigneeUserOptions({
        users,
        crmAccount: createAccount,
      }),
    [createAccount, users],
  );

  const defaultAssigneeIds = useMemo(
    () => resolveDefaultTaskAssigneeIds({ crmAccount: createAccount, users }),
    [createAccount, users],
  );

  const form = useTaskFormState({
    users: assignees,
    defaultAssigneeIds,
    editing,
    companyId: createAccountId,
  });

  function canManageTask(task?: FollowUpTask) {
    if (!task) return false;
    if (isAdmin || can("manageTasks")) return true;
    const account = visibleAccounts.find((a) => a.id === task.companyId);
    return account ? canManageCrmAccountTasks(account, currentUser) : false;
  }

  const canCreate =
    isAdmin ||
    can("manageTasks") ||
    visibleAccounts.some((a) => canManageCrmAccountTasks(a, currentUser));

  function openCreate() {
    setEditing(null);
    setCreateAccountId(visibleAccounts[0]?.id ?? "");
    form.reset();
    setRemark("");
    setMarkCompleteOnCreate(false);
    setModalOpen(true);
  }

  function openEdit(task: FollowUpTask) {
    setEditing(task);
    setCreateAccountId(task.companyId);
    setRemark("");
    setModalOpen(true);
    onSelectTask(task.id);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const companyId = createAccountId || editing?.companyId;
    if (!companyId) {
      toast.error("Account is required");
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
    accountFilter !== "all",
    typeFilter !== "all",
    statusFilter !== "all",
    assigneeFilter !== "all",
    sourceFilter !== "all",
  ].filter(Boolean).length;

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const task of crmTasks) {
      for (const id of resolveTaskAssigneeIds(task)) ids.add(id);
    }
    return [
      { value: "all", label: "All assignees" },
      ...users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.name })),
    ];
  }, [crmTasks, users]);

  return (
    <PageWrap>
      <DesignTicketPageHeader
        title="Tasks"
        subtitle="Schedule, assign, and track follow-ups across CRM accounts"
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
        columns={6}
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
            id: "booking",
            label: "From bookings",
            value: kpis.fromBooking,
            icon: Link2,
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
        onChange={(id) => onTabChange(id as CrmTasksTabId)}
      />

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show" className="space-y-2.5">
        {!isCalendarTab(tab) ? (
          <ListToolbar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search tasks, accounts, descriptions…"
            resultCount={filtered.length}
            resultLabel="tasks"
            activeFilterCount={activeFilterCount}
            onClear={() => {
              setQuery("");
              setAccountFilter("all");
              setTypeFilter("all");
              setStatusFilter("all");
              setAssigneeFilter("all");
              setSourceFilter("all");
            }}
            selects={[
              {
                id: "account",
                label: "Account",
                value: accountFilter,
                onChange: setAccountFilter,
                options: [
                  { value: "all", label: "All accounts" },
                  ...accountOptions.map((a) => ({ value: a.id, label: a.name })),
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
              {
                id: "source",
                label: "Source",
                value: sourceFilter,
                onChange: setSourceFilter,
                options: [
                  { value: "all", label: "All sources" },
                  { value: "manual", label: "Manual" },
                  { value: "booking", label: "Booking" },
                ],
              },
            ]}
          />
        ) : null}

        <TaskCalendarPanel
          tasks={isCalendarTab(tab) ? tabFiltered : filtered}
          users={users}
          companies={accountOptions}
          view={calendarView}
          onViewChange={(v) => onTabChange(v)}
          onTaskClick={(task) => onSelectTask(task.id)}
          canManage={canCreate}
          embedded={!isCalendarTab(tab)}
          hideViewToggle
          entityLinkTarget="crm"
        />

        {selectedTask ? (
          <TaskDetailPanel
            task={selectedTask}
            accountName={accountOptions.find((a) => a.id === selectedTask.companyId)?.name ?? "—"}
            users={users}
            canManage={canManageTask(selectedTask)}
            onEdit={() => openEdit(selectedTask)}
            onComplete={() => {
              completeTask(selectedTask.id);
              toast.success("Task marked complete");
              onSelectTask(undefined);
            }}
            onCancel={() => {
              cancelTask(selectedTask.id);
              toast.success("Task cancelled");
              onSelectTask(undefined);
            }}
            onClose={() => onSelectTask(undefined)}
          />
        ) : null}
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
            Account
            <select
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={createAccountId}
              onChange={(e) => {
                setCreateAccountId(e.target.value);
              }}
            >
              <option value="">Select account</option>
              {visibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : editingAccount ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Account: <span className="font-medium text-foreground">{editingAccount.name}</span>
          </p>
        ) : null}

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
              </>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </PageWrap>
  );
}

function TaskDetailPanel({
  task,
  accountName,
  users,
  canManage,
  onEdit,
  onComplete,
  onCancel,
  onClose,
}: {
  task: FollowUpTask;
  accountName: string;
  users: User[];
  canManage: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const assigneeLabels = resolveTaskAssigneeIds(task)
    .map((id) => resolveAssigneeLabel(id, users))
    .join(", ");

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={statusTone(task.status)}>{task.status.replace(/_/g, " ")}</Pill>
          {task.taskType ? (
            <span className="text-xs font-medium text-muted-foreground">
              {FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType]}
            </span>
          ) : null}
          <span className="text-xs capitalize text-muted-foreground">{task.source ?? "manual"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canManage ? (
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px]" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canManage && task.status !== "completed" && task.status !== "cancelled" ? (
            <>
              <Button size="sm" className="h-7 gap-1 px-2.5 text-[10px]" onClick={onComplete}>
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Button>
              {task.source !== "booking" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] text-destructive"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              ) : null}
            </>
          ) : null}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        <TaskDetailSection icon={LayoutList} title="Task">
          <div className="text-sm font-semibold">{task.title}</div>
          {task.description ? (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          ) : null}
        </TaskDetailSection>

        <TaskDetailSection icon={Calendar} title="Schedule">
          <div className="text-sm font-medium">
            {task.dueDate ? formatDate(task.dueDate) : "No date set"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatTimeRange12h(task.startTime, task.endTime)}
            {task.durationMinutes ? ` · ${task.durationMinutes} mins` : ""}
          </div>
        </TaskDetailSection>

        <TaskDetailSection icon={Users} title="Assignees">
          <div className="text-sm font-medium">{assigneeLabels || "Unassigned"}</div>
        </TaskDetailSection>

        <TaskDetailSection icon={Building2} title="Account">
          <Link
            to="/crm/accounts/$accountId"
            params={{ accountId: task.companyId }}
            search={{ tab: "tasks" }}
            className="text-sm font-medium text-primary hover:underline"
          >
            {accountName}
          </Link>
        </TaskDetailSection>

        {task.completedAt ? (
          <TaskDetailSection icon={CheckCircle2} title="Completed" className="lg:col-span-2">
            <div className="text-sm">{formatDateTime(task.completedAt)}</div>
          </TaskDetailSection>
        ) : null}

        {task.bookingAppointmentId ? (
          <TaskDetailSection icon={Link2} title="Linked booking" className="lg:col-span-2">
            <Link
              to="/crm/bookings"
              search={{ tab: "all" }}
              className="text-xs text-primary hover:underline"
            >
              View in Bookings
            </Link>
          </TaskDetailSection>
        ) : null}
      </div>
    </div>
  );
}

function TaskDetailSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: typeof Calendar;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/10 p-3", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}
