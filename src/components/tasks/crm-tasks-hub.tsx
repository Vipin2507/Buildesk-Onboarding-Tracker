import {
  Ban,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutList,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFilterBar,
  DesignTicketTabNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
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
import {
  canManageCrmAccountTasks,
  filterCrmAccountsForUser,
} from "@/lib/crm-account-access";
import { resolveDefaultTaskAssigneeIds, taskAssigneeUserOptions } from "@/lib/task-defaults";
import { resolveTaskAssigneeIds } from "@/lib/task-scheduling";
import { useTaskTimeStatusSync, useTasksWithTimeStatus } from "@/hooks/use-task-time-status";
import { useAuthStore, useCrmAccountStore, useCrmTaskStore, useUserStore } from "@/stores";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
} from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import type { CrmTasksTabId } from "@/lib/crm-route-search";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const OPEN_STATUSES: FollowUpTaskStatus[] = ["open", "in_progress", "blocked"];

const TASK_FILTER_CHIPS = [
  { id: "all", label: "All" },
  { id: "my", label: "My tasks" },
  { id: "open", label: "Open" },
  { id: "today", label: "Due today" },
  { id: "overdue", label: "Overdue" },
] as const;

type TaskFilterChipId = (typeof TASK_FILTER_CHIPS)[number]["id"];

const TASK_LIST_TAB_IDS = new Set<TaskFilterChipId>(
  TASK_FILTER_CHIPS.map((chip) => chip.id),
);

const CALENDAR_VIEW_TABS = [
  { id: "list", label: "List view", icon: LayoutList },
  { id: "day", label: "Day", icon: Clock },
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "month", label: "Month", icon: Calendar },
] as const;

type TaskFilterTone = "muted" | "warning" | "success" | "info" | "danger";

const TASK_FILTER_BOX_COUNT_TONE: Record<TaskFilterTone, string> = {
  muted: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  danger: "text-destructive",
};

function taskFilterChipTone(id: TaskFilterChipId): TaskFilterTone {
  if (id === "overdue") return "danger";
  if (id === "today") return "warning";
  if (id === "open") return "info";
  if (id === "my") return "success";
  return "muted";
}

function matchesTaskListTab(
  task: FollowUpTask,
  tabId: TaskFilterChipId,
  today: string,
  currentUserId?: string,
) {
  if (tabId === "my") {
    return currentUserId ? resolveTaskAssigneeIds(task).includes(currentUserId) : false;
  }
  if (tabId === "open") return OPEN_STATUSES.includes(task.status);
  if (tabId === "today") {
    return OPEN_STATUSES.includes(task.status) && task.dueDate === today;
  }
  if (tabId === "overdue") {
    return OPEN_STATUSES.includes(task.status) && Boolean(task.dueDate && task.dueDate < today);
  }
  return true;
}

type TaskToolbarFilters = {
  accountFilter: string;
  typeFilter: string;
  statusFilter: string;
  assigneeFilter: string;
  sourceFilter: string;
  tableSearch: string;
};

function matchesTaskToolbarFilters(
  task: FollowUpTask,
  filters: TaskToolbarFilters,
  accountOptions: { id: string; name: string }[],
) {
  if (filters.accountFilter !== "all" && task.companyId !== filters.accountFilter) return false;
  if (filters.typeFilter !== "all" && task.taskType !== filters.typeFilter) return false;
  if (filters.statusFilter !== "all" && task.status !== filters.statusFilter) return false;
  if (filters.sourceFilter !== "all" && (task.source ?? "manual") !== filters.sourceFilter) {
    return false;
  }
  if (
    filters.assigneeFilter !== "all" &&
    !resolveTaskAssigneeIds(task).includes(filters.assigneeFilter)
  ) {
    return false;
  }
  const q = filters.tableSearch.trim().toLowerCase();
  if (!q) return true;
  const accountName = accountOptions.find((a) => a.id === task.companyId)?.name ?? "";
  return (
    task.title.toLowerCase().includes(q) ||
    accountName.toLowerCase().includes(q) ||
    (task.description ?? "").toLowerCase().includes(q)
  );
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
  const tasks = useCrmTaskStore((s) => s.tasks);
  useTaskTimeStatusSync(true, "crm");
  const timeAwareTasks = useTasksWithTimeStatus(tasks);
  const addTask = useCrmTaskStore((s) => s.addTask);
  const updateTask = useCrmTaskStore((s) => s.updateTask);
  const completeTask = useCrmTaskStore((s) => s.completeTask);
  const cancelTask = useCrmTaskStore((s) => s.cancelTask);
  const deleteTask = useCrmTaskStore((s) => s.deleteTask);
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
    () => timeAwareTasks.filter((t) => accountIds.has(t.companyId)),
    [timeAwareTasks, accountIds],
  );

  const today = new Date().toISOString().slice(0, 10);

  const tableRef = useRef<HTMLDivElement>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const listFilters = useMemo(
    () => ({
      accountFilter,
      typeFilter,
      statusFilter,
      assigneeFilter,
      sourceFilter,
      tableSearch,
    }),
    [accountFilter, typeFilter, statusFilter, assigneeFilter, sourceFilter, tableSearch],
  );

  const toolbarScoped = useMemo(
    () => crmTasks.filter((task) => matchesTaskToolbarFilters(task, listFilters, accountOptions)),
    [crmTasks, listFilters, accountOptions],
  );

  const isListFilterTab = TASK_LIST_TAB_IDS.has(tab as TaskFilterChipId);
  const listTab = isListFilterTab ? (tab as TaskFilterChipId) : "all";

  const filtered = useMemo(() => {
    return toolbarScoped.filter((task) =>
      matchesTaskListTab(task, listTab, today, currentUser?.id),
    );
  }, [toolbarScoped, listTab, today, currentUser?.id]);

  function taskFilterChipCount(id: TaskFilterChipId) {
    return toolbarScoped.filter((task) =>
      matchesTaskListTab(task, id, today, currentUser?.id),
    ).length;
  }

  const fromMeetingCount = useMemo(
    () =>
      toolbarScoped.filter(
        (task) => task.source === "booking" && OPEN_STATUSES.includes(task.status),
      ).length,
    [toolbarScoped],
  );

  const tabFiltered = useMemo(() => crmTasks, [crmTasks]);

  const selectedTask = selectedTaskId ? crmTasks.find((t) => t.id === selectedTaskId) : undefined;
  const editingAccount = selectedTask
    ? visibleAccounts.find((a) => a.id === selectedTask.companyId)
    : undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpTask | null>(null);
  const [createAccountId, setCreateAccountId] = useState("");
  const [remark, setRemark] = useState("");
  const [markCompleteOnCreate, setMarkCompleteOnCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpTask | null>(null);

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
    markCompleteOnCreate,
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

  function clearFilters() {
    setTableSearch("");
    setAccountFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setSourceFilter("all");
  }

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showFromMeetings() {
    onTabChange("open");
    setSourceFilter("booking");
  }

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

  function toggleTaskSelection(task: FollowUpTask) {
    onSelectTask(selectedTaskId === task.id ? undefined : task.id);
  }

  function renderTaskDetail(task: FollowUpTask) {
    return (
      <TaskDetailPanel
        embedded
        task={task}
        accountName={accountOptions.find((a) => a.id === task.companyId)?.name ?? "—"}
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
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground">
              {isListFilterTab
                ? `${filtered.length} ${filtered.length === 1 ? "task" : "tasks"}`
                : "Calendar views across CRM accounts"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {canCreate ? (
              <Button
                size="sm"
                className="h-8 gap-1 bg-primary px-3 text-xs"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                Create task
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div
            role="tablist"
            aria-label="Task filters"
            className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5"
          >
            {TASK_FILTER_CHIPS.map((chip) => {
              const tone = taskFilterChipTone(chip.id);
              const active = isListFilterTab && listTab === chip.id;
              const count = taskFilterChipCount(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(chip.id)}
                  className={cn(
                    "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                    "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/80",
                  )}
                >
                  <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {chip.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-lg font-semibold tabular-nums leading-none",
                      TASK_FILTER_BOX_COUNT_TONE[tone],
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={showFromMeetings}
            className={cn(
              "flex shrink-0 flex-col justify-center rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-all lg:min-w-[5.5rem]",
              "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isListFilterTab && listTab === "open" && sourceFilter === "booking"
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/80",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              From meetings
            </span>
            <span className="mt-1 text-lg font-semibold tabular-nums leading-none text-primary">
              {fromMeetingCount}
            </span>
          </button>
        </div>

        <div className="mt-2">
          <DesignTicketTabNav
            compact
            tabs={CALENDAR_VIEW_TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
            activeId={isCalendarTab(tab) ? tab : ""}
            onChange={(id) => onTabChange(id as CrmTasksTabId)}
          />
        </div>
      </div>

      <motion.div variants={ticketSectionVariants} initial="hidden" animate="show" className="space-y-2.5">
        {isListFilterTab ? (
          <div className="-mx-3 sm:-mx-4 lg:-mx-5">
            <div className="px-3 sm:px-4 lg:px-5">
              <DesignTicketFilterBar
                variant="inline"
                compact
                className="xl:grid-cols-4"
                activeFilterCount={activeFilterCount}
                onClear={clearFilters}
                onApply={applyFilters}
                resultCount={filtered.length}
                resultLabel={filtered.length === 1 ? "task" : "tasks"}
                trailing={
                  <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search tasks, accounts…"
                      aria-label="Search tasks"
                      className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                }
              >
                <DesignTicketFilterField label="Account" compact>
                  <DesignTicketSelect
                    compact
                    value={accountFilter}
                    onChange={setAccountFilter}
                    options={[
                      { value: "all", label: "All accounts" },
                      ...accountOptions.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                </DesignTicketFilterField>
                <DesignTicketFilterField label="Task type" compact>
                  <DesignTicketSelect
                    compact
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                      { value: "all", label: "All types" },
                      ...Object.entries(FOLLOW_UP_TASK_TYPE_LABEL).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                </DesignTicketFilterField>
                <DesignTicketFilterField label="Status" compact>
                  <DesignTicketSelect
                    compact
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "open", label: "Open" },
                      { value: "in_progress", label: "In progress" },
                      { value: "blocked", label: "Blocked" },
                      { value: "completed", label: "Completed" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </DesignTicketFilterField>
                <DesignTicketFilterField label="Assignee" compact>
                  <DesignTicketSelect
                    compact
                    value={assigneeFilter}
                    onChange={setAssigneeFilter}
                    options={assigneeOptions}
                  />
                </DesignTicketFilterField>
                <DesignTicketFilterField label="Source" compact>
                  <DesignTicketSelect
                    compact
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    options={[
                      { value: "all", label: "All sources" },
                      { value: "manual", label: "Manual" },
                      { value: "booking", label: "Meeting" },
                    ]}
                  />
                </DesignTicketFilterField>
              </DesignTicketFilterBar>
            </div>

            <div ref={tableRef} className="min-w-0">
              <TaskCalendarPanel
                tasks={filtered}
                users={users}
                companies={accountOptions}
                view="list"
                onViewChange={(v) => onTabChange(v)}
                onTaskClick={toggleTaskSelection}
                selectedTaskId={selectedTaskId}
                renderTaskDetail={renderTaskDetail}
                canManage={canCreate}
                embedded
                flush
                hideViewToggle
                entityLinkTarget="crm"
              />
            </div>
          </div>
        ) : (
          <div className="px-0">
            <TaskCalendarPanel
              tasks={tabFiltered}
              users={users}
              companies={accountOptions}
              view={calendarView}
              onViewChange={(v) => onTabChange(v)}
              onTaskClick={toggleTaskSelection}
              selectedTaskId={selectedTaskId}
              renderTaskDetail={renderTaskDetail}
              canManage={canCreate}
              hideViewToggle
              entityLinkTarget="crm"
            />
          </div>
        )}
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
          productScope="crm"
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
