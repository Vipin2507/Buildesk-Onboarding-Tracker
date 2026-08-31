import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { TimePickerField } from "@/components/time-picker-field";
import {
  ticketFieldClass,
  ticketSelectClass,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { MultiAssigneeSelect } from "@/components/tasks/multi-assignee-select";
import {
  buildTaskScheduleWindow,
  calcDurationFromTimes,
  calcEndTimeFromDuration,
  isPastDateYmd,
  isTimeBeforeMin,
  minEndTimeForSchedule,
  minSelectableTimeForDate,
  todayYmd,
} from "@/lib/task-scheduling";
import { cn } from "@/lib/utils";
import { checkErpTaskScheduleConflicts, checkTaskScheduleConflicts } from "@/lib/api";
import {
  FOLLOW_UP_TASK_TYPES,
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskType,
  type TaskProductScope,
} from "@/types";

export type TaskFormValues = {
  title: string;
  description: string;
  dueDate: string;
  taskType: FollowUpTaskType | "";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  assigneeUserIds: string[];
};

type Props = {
  users: { id: string; name: string; active?: boolean }[];
  defaultAssigneeIds?: string[];
  initial?: Partial<TaskFormValues>;
  editing?: FollowUpTask | null;
  showCompanyField?: boolean;
  companyId?: string;
  onCompanyIdChange?: (id: string) => void;
  companies?: { id: string; name: string }[];
  markCompleteOnCreate?: boolean;
  onMarkCompleteOnCreateChange?: (checked: boolean) => void;
  productScope?: TaskProductScope;
};

const fieldClass = cn(ticketFieldClass, "h-8 text-xs");
const selectClass = cn(ticketSelectClass, "h-8 text-xs");
const areaClass = cn(ticketTextareaClass, "min-h-[72px] text-xs");

function allowPastSchedule(props: Pick<Props, "editing" | "markCompleteOnCreate">) {
  return Boolean(!props.editing && props.markCompleteOnCreate);
}

export function useTaskFormState(props: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskType, setTaskType] = useState<FollowUpTaskType | "">("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState(props.companyId ?? "");

  useEffect(() => {
    if (props.initial) {
      setTitle(props.initial.title ?? "");
      setDescription(props.initial.description ?? "");
      setDueDate(props.initial.dueDate ?? "");
      setTaskType(props.initial.taskType ?? "");
      setStartTime(props.initial.startTime ?? "");
      setEndTime(props.initial.endTime ?? "");
      setDurationMinutes(props.initial.durationMinutes ?? 60);
      setAssigneeUserIds(props.initial.assigneeUserIds ?? []);
    }
  }, [props.initial]);

  useEffect(() => {
    if (props.editing) {
      setTitle(props.editing.title);
      setDescription(props.editing.description ?? "");
      setDueDate(props.editing.dueDate ?? "");
      setTaskType(props.editing.taskType ?? "");
      setStartTime(props.editing.startTime ?? "");
      setEndTime(props.editing.endTime ?? "");
      setDurationMinutes(props.editing.durationMinutes ?? 60);
      setAssigneeUserIds(
        props.editing.assigneeUserIds?.length
          ? props.editing.assigneeUserIds
          : props.editing.assigneeUserId
            ? [props.editing.assigneeUserId]
            : [],
      );
    }
  }, [props.editing]);

  useEffect(() => {
    if (!props.editing && props.defaultAssigneeIds?.length && assigneeUserIds.length === 0) {
      setAssigneeUserIds(props.defaultAssigneeIds);
    }
  }, [props.defaultAssigneeIds, props.editing, assigneeUserIds.length]);

  useEffect(() => {
    if (!props.editing && props.companyId && props.defaultAssigneeIds?.length) {
      setAssigneeUserIds(props.defaultAssigneeIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset assignees when company/account changes
  }, [props.companyId, props.editing]);

  useEffect(() => {
    if (props.companyId) setCompanyId(props.companyId);
  }, [props.companyId]);

  function onDueDateChange(next: string) {
    setDueDate(next);
    if (props.editing || !next || allowPastSchedule(props)) return;
    if (isPastDateYmd(next)) {
      setDueDate("");
      return;
    }
    if (startTime) {
      const min = minSelectableTimeForDate(next);
      if (min && isTimeBeforeMin(startTime, min)) {
        setStartTime("");
        setEndTime("");
      }
    }
  }

  function onStartTimeChange(next: string) {
    setStartTime(next);
    if (dueDate && next && durationMinutes > 0) {
      setEndTime(calcEndTimeFromDuration(next, durationMinutes));
    }
  }

  function onDurationChange(next: number) {
    setDurationMinutes(next);
    if (startTime && next > 0) {
      setEndTime(calcEndTimeFromDuration(startTime, next));
    }
  }

  function onEndTimeChange(next: string) {
    setEndTime(next);
    if (startTime && next) {
      const mins = calcDurationFromTimes(startTime, next);
      if (mins > 0) setDurationMinutes(mins);
    }
  }

  async function validateSchedule(): Promise<boolean> {
    const allowPast = allowPastSchedule(props);
    if (!props.editing && !allowPast && dueDate && isPastDateYmd(dueDate)) {
      toast.error("Due date cannot be in the past");
      return false;
    }
    if (!taskType || !dueDate || !startTime) return true;
    const todayMin = !props.editing && !allowPast ? minSelectableTimeForDate(dueDate) : undefined;
    if (todayMin && isTimeBeforeMin(startTime, todayMin)) {
      toast.error("Start time cannot be in the past");
      return false;
    }
    if (!props.editing && !allowPast && endTime) {
      const endMin = minEndTimeForSchedule({ dueDate, startTime });
      if (endMin && isTimeBeforeMin(endTime, endMin)) {
        toast.error("End time cannot be in the past");
        return false;
      }
    }
    const window = buildTaskScheduleWindow({
      dueDate,
      startTime,
      endTime: endTime || undefined,
      durationMinutes,
    });
    if (!window) {
      toast.error("End time must be after start time");
      return false;
    }
    if (assigneeUserIds.length === 0) {
      toast.error("Assign at least one user for a scheduled task");
      return false;
    }
    try {
      const checkConflicts =
        props.productScope === "erp" ? checkErpTaskScheduleConflicts : checkTaskScheduleConflicts;
      const result = await checkConflicts({
        data: {
          assigneeUserIds,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          excludeTaskId: props.editing?.id,
          ...(props.productScope === "crm"
            ? { excludeBookingId: props.editing?.bookingAppointmentId }
            : {}),
        },
      });
      if (result.hasConflict) {
        toast.error(result.message ?? "Schedule conflict detected");
        return false;
      }
    } catch {
      /* server validates on save */
    }
    return true;
  }

  const values: TaskFormValues = {
    title,
    description,
    dueDate,
    taskType,
    startTime,
    endTime,
    durationMinutes,
    assigneeUserIds,
  };

  return {
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate: onDueDateChange,
    taskType,
    setTaskType,
    startTime,
    onStartTimeChange,
    endTime,
    onEndTimeChange,
    durationMinutes,
    onDurationChange,
    assigneeUserIds,
    setAssigneeUserIds,
    companyId,
    setCompanyId,
    values,
    validateSchedule,
    reset: () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      setTaskType("");
      setStartTime("");
      setEndTime("");
      setDurationMinutes(60);
      setAssigneeUserIds(props.defaultAssigneeIds ?? []);
    },
  };
}

export function TaskFormFields(props: Props & ReturnType<typeof useTaskFormState>) {
  const {
    users,
    showCompanyField,
    companies,
    onCompanyIdChange,
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate,
    taskType,
    setTaskType,
    startTime,
    onStartTimeChange,
    endTime,
    onEndTimeChange,
    durationMinutes,
    onDurationChange,
    assigneeUserIds,
    setAssigneeUserIds,
    companyId,
    setCompanyId,
    editing,
    markCompleteOnCreate,
    onMarkCompleteOnCreateChange,
  } = props;

  const scheduled = Boolean(taskType);
  const readOnlyBooking = editing?.source === "booking";
  const showMarkCompleteOnCreate = !editing && Boolean(onMarkCompleteOnCreateChange);
  const allowPast = allowPastSchedule({ editing, markCompleteOnCreate });
  const blockPastSchedule = !editing && !allowPast;
  const startTimeMin = blockPastSchedule && dueDate ? minSelectableTimeForDate(dueDate) : undefined;
  const endTimeMin =
    blockPastSchedule && dueDate
      ? minEndTimeForSchedule({ dueDate, startTime: startTime || undefined })
      : undefined;

  return (
    <div className="space-y-3">
      {showCompanyField ? (
        <label className="block text-xs font-medium">
          Company
          <select
            className={cn(selectClass, "mt-1 w-full")}
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              onCompanyIdChange?.(e.target.value);
            }}
          >
            <option value="">Select company</option>
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block text-xs font-medium">
        Task title
        <input
          className={cn(fieldClass, "mt-1 w-full")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Client meeting, follow-up call…"
          disabled={readOnlyBooking}
        />
      </label>

      <label className="block text-xs font-medium">
        Description
        <textarea
          className={cn(areaClass, "mt-1 w-full")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task details and context…"
        />
      </label>

      <label className="block text-xs font-medium">
        Task type
        <select
          className={cn(selectClass, "mt-1 w-full")}
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as FollowUpTaskType | "")}
          disabled={readOnlyBooking}
        >
          <option value="">Select type (optional)</option>
          {FOLLOW_UP_TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {FOLLOW_UP_TASK_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium">
        Due date / scheduled date
        <div className="mt-1">
          <DatePickerField
            value={dueDate}
            onChange={setDueDate}
            modal
            min={blockPastSchedule ? todayYmd() : undefined}
            yearsBack={allowPast ? 5 : blockPastSchedule ? 0 : 1}
            yearsForward={3}
            disabled={readOnlyBooking}
          />
        </div>
      </label>

      {scheduled ? (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">
              Start time
              <div className="mt-1">
                <TimePickerField
                  value={startTime}
                  onChange={onStartTimeChange}
                  min={startTimeMin}
                  modal
                  compact
                  disabled={readOnlyBooking}
                />
              </div>
            </label>
            <label className="block text-xs font-medium">
              End time
              <div className="mt-1">
                <TimePickerField
                  value={endTime}
                  onChange={onEndTimeChange}
                  min={endTimeMin}
                  modal
                  compact
                  disabled={readOnlyBooking}
                />
              </div>
            </label>
          </div>
          <label className="block text-xs font-medium">
            Duration ({durationMinutes} mins)
            <input
              type="range"
              min={5}
              max={240}
              step={5}
              className="mt-2 w-full accent-primary"
              value={durationMinutes}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              disabled={readOnlyBooking}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>5m</span>
              <span>4h</span>
            </div>
          </label>
        </div>
      ) : null}

      <div>
        <div className="mb-1 text-xs font-medium">Assignee(s)</div>
        <MultiAssigneeSelect
          users={users}
          value={assigneeUserIds}
          onChange={setAssigneeUserIds}
          disabled={readOnlyBooking}
          modal
          placeholder="Select assignees (defaults to support manager 1)"
        />
      </div>

      {showMarkCompleteOnCreate ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/10 px-3 py-2.5 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input accent-primary"
            checked={markCompleteOnCreate ?? false}
            onChange={(e) => {
              const checked = e.target.checked;
              onMarkCompleteOnCreateChange?.(checked);
              if (!checked && dueDate && isPastDateYmd(dueDate)) {
                setDueDate("");
              }
            }}
          />
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Mark as complete when creating</span>
        </label>
      ) : null}

      {editing?.source === "booking" ? (
        <p className="text-[10px] text-muted-foreground">
          Linked to meeting {editing.bookingAppointmentId?.slice(0, 8)}… — schedule syncs from meeting.
        </p>
      ) : null}
    </div>
  );
}
