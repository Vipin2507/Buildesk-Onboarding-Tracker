import { Link } from "@tanstack/react-router";
import { CheckCircle2, Link2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveAssigneeLabel } from "@/lib/managers";
import {
  formatTaskDurationDisplay,
  formatTimeRange12h,
  resolveTaskAssigneeIds,
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
  const extraTime = resolveTaskExtraTimeMinutes(task);
  const canAct = canManage && task.status !== "completed" && task.status !== "cancelled";

  function submitRemark() {
    const text = remarkDraft.trim();
    if (!text || !onAddRemark) return;
    onAddRemark(text);
    setRemarkDraft("");
  }

  return (
    <div
      className={cn(
        "text-xs",
        embedded
          ? "border-t border-primary/10 bg-muted/25 px-2.5 py-2"
          : "card-soft overflow-hidden p-3",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {!embedded ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={statusTone(task.status)}>{task.status.replace(/_/g, " ")}</Pill>
              {task.taskType ? (
                <span className="text-[10px] text-muted-foreground">
                  {FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType]}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <MetaItem label="When">
              {task.dueDate ? formatDate(task.dueDate) : "—"}
              {task.startTime ? ` · ${formatTimeRange12h(task.startTime, task.endTime)}` : ""}
            </MetaItem>
            <MetaItem label="Duration">{formatTaskDurationDisplay(task)}</MetaItem>
            <MetaItem label="Assignee">{assigneeLabels || "—"}</MetaItem>
            <MetaItem label="Account">
              <Link
                to="/crm/accounts/$accountId"
                params={{ accountId: task.companyId }}
                search={{ tab: "tasks" }}
                className="font-medium text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {accountName}
              </Link>
            </MetaItem>
            {task.completedAt ? (
              <MetaItem label="Completed">{formatDateTime(task.completedAt)}</MetaItem>
            ) : null}
            {task.bookingAppointmentId ? (
              <MetaItem label="Booking">
                <Link
                  to="/crm/bookings"
                  search={{ tab: "all" }}
                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link2 className="h-3 w-3" />
                  View
                </Link>
              </MetaItem>
            ) : null}
          </div>

          {task.description ? (
            <p className="line-clamp-2 text-[11px] leading-snug text-foreground/90">
              {task.description}
            </p>
          ) : null}

          {task.latestRemark ? (
            <p className="line-clamp-2 text-[11px] italic leading-snug text-muted-foreground">
              Remark: {task.latestRemark}
            </p>
          ) : null}

          {canManage && onAddRemark ? (
            <div className="flex max-w-md gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Input
                value={remarkDraft}
                onChange={(e) => setRemarkDraft(e.target.value)}
                placeholder="Add remark…"
                className="h-7 flex-1 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitRemark();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                disabled={!remarkDraft.trim()}
                onClick={submitRemark}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          ) : null}

          {scheduled && canManage && onAddExtraTime ? (
            <div
              className="flex flex-wrap items-center gap-1.5 pt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Extra
              </span>
              {EXTRA_TIME_OPTIONS.map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] tabular-nums"
                  onClick={() => onAddExtraTime(mins)}
                >
                  +{mins}m
                </Button>
              ))}
              {extraTime > 0 ? (
                <span className="text-[10px] font-medium text-primary tabular-nums">
                  +{extraTime}m total
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {canManage ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canAct ? (
            <>
              <Button size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={onComplete}>
                <CheckCircle2 className="h-3 w-3" />
                Done
              </Button>
              {task.source !== "booking" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] text-destructive"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              ) : null}
            </>
          ) : null}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </span>
      <span className="min-w-0 truncate text-foreground">{children}</span>
    </span>
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
