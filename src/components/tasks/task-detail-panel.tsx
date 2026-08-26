import { Link } from "@tanstack/react-router";
import {
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  LayoutList,
  Link2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { resolveAssigneeLabel } from "@/lib/managers";
import { formatTimeRange12h, resolveTaskAssigneeIds } from "@/lib/task-scheduling";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskStatus,
  type FollowUpTaskType,
  type User,
} from "@/types";

const ease = [0.22, 1, 0.36, 1] as const;

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
}: Props) {
  const assigneeLabels = resolveTaskAssigneeIds(task)
    .map((id) => resolveAssigneeLabel(id, users))
    .join(", ");

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
