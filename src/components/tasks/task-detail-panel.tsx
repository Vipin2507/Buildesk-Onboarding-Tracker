import { Link } from "@tanstack/react-router";
import {
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  LayoutList,
  Link2,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";

import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { resolveAssigneeLabel } from "@/lib/managers";
import {
  formatTaskDurationDisplay,
  formatTimeRange12h,
  resolveTaskAssigneeIds,
  resolveTaskDurationMinutes,
  resolveTaskExtraTimeMinutes,
  taskHasSchedule,
} from "@/lib/task-scheduling";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
  type FollowUpTaskType,
  type User,
} from "@/types";

const ease = [0.22, 1, 0.36, 1] as const;

const EXTRA_TIME_OPTIONS = [5, 10, 15, 30, 60] as const;

function statusTone(status: FollowUpTaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "blocked") return "warning" as const;
  return "muted" as const;
}

type Props = {
  task: FollowUpTask;
  accountName: string;
  users: User[];
  canManage: boolean;
  embedded?: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onAddRemark?: (remark: string) => void;
  onAddExtraTime?: (minutes: number) => void;
};

export function TaskDetailPanel({
  task,
  accountName,
  users,
  canManage,
  embedded = false,
  onEdit,
  onComplete,
  onCancel,
  onClose,
  onAddRemark,
  onAddExtraTime,
}: Props) {
  const [remarkDraft, setRemarkDraft] = useState("");
  const assigneeLabels = resolveTaskAssigneeIds(task)
    .map((id) => resolveAssigneeLabel(id, users))
    .join(", ");
  const scheduled = taskHasSchedule(task);
  const plannedDuration = resolveTaskDurationMinutes(task);
  const extraTime = resolveTaskExtraTimeMinutes(task);

  function submitRemark() {
    const text = remarkDraft.trim();
    if (!text || !onAddRemark) return;
    onAddRemark(text);
    setRemarkDraft("");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease }}
      className={cn(
        embedded ? "border-t border-primary/15 bg-primary/[0.03]" : "card-soft overflow-hidden",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20",
          embedded ? "px-3 py-2" : "px-4 py-2.5",
        )}
      >
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
            Close
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-3 lg:grid-cols-2", embedded ? "p-3" : "p-4")}>
        <TaskDetailSection icon={LayoutList} title="Task">
          <div className="text-sm font-semibold">{task.title}</div>
          {task.description ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.description}</p>
          ) : null}
        </TaskDetailSection>

        <TaskDetailSection icon={Calendar} title="Schedule">
          <div className="text-sm font-medium">
            {task.dueDate ? formatDate(task.dueDate) : "No date set"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatTimeRange12h(task.startTime, task.endTime)}
          </div>
          <div className="mt-1 text-xs font-medium tabular-nums">
            Duration: {formatTaskDurationDisplay(task)}
          </div>
          {plannedDuration && extraTime > 0 ? (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Planned {plannedDuration}m + {extraTime}m extra
            </div>
          ) : null}
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

        <TaskDetailSection icon={MessageSquare} title="Remarks" className="lg:col-span-2">
          {task.latestRemark ? (
            <p className="mb-2 rounded-md border bg-background px-2.5 py-2 text-xs text-foreground">
              {task.latestRemark}
            </p>
          ) : (
            <p className="mb-2 text-xs text-muted-foreground">No remarks yet.</p>
          )}
          {canManage && onAddRemark ? (
            <div className="space-y-2">
              <textarea
                className="min-h-[56px] w-full rounded-md border bg-background px-3 py-2 text-xs"
                value={remarkDraft}
                onChange={(e) => setRemarkDraft(e.target.value)}
                placeholder="Add a remark about progress, blockers, or outcome…"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={!remarkDraft.trim()}
                onClick={submitRemark}
              >
                Add remark
              </Button>
            </div>
          ) : null}
        </TaskDetailSection>

        {scheduled && canManage && onAddExtraTime ? (
          <TaskDetailSection icon={Clock} title="Extra time" className="lg:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">
              Extend this task when it runs longer than the assigned slot. End time and duration update
              automatically.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_TIME_OPTIONS.map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] tabular-nums"
                  onClick={() => onAddExtraTime(mins)}
                >
                  +{mins}m
                </Button>
              ))}
            </div>
            {extraTime > 0 ? (
              <p className="mt-2 text-[10px] font-medium text-primary">
                Total extra time: {extraTime}m
              </p>
            ) : null}
          </TaskDetailSection>
        ) : null}

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
    </motion.div>
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

/** Latest remark snippet for task list rows. */
export function TaskRowRemark({ task }: { task: FollowUpTask }) {
  if (!task.latestRemark) return null;
  return (
    <div className="mt-0.5 line-clamp-1 text-[10px] italic text-muted-foreground">
      “{task.latestRemark}”
    </div>
  );
}
