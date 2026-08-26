import { useEffect, useMemo, useState } from "react";

import { countTasksInReminderWindow } from "@/lib/task-reminder-window";
import { taskWallClockNow } from "@/lib/task-scheduling";
import { useAuthStore, useCrmSettingsStore, useTaskStore } from "@/stores";

const TICK_MS = 15_000;

/** Count of scheduled tasks assigned to the current user inside the pre-start reminder window. */
export function useUpcomingTaskReminderCount() {
  const userId = useAuthStore((s) => s.user?.id);
  const tasks = useTaskStore((s) => s.tasks);
  const enabled = useCrmSettingsStore((s) => s.notifications.taskReminderInAppEnabled);
  const offsetMinutes = useCrmSettingsStore((s) => s.notifications.taskReminderMinutesBefore);
  const [now, setNow] = useState(() => taskWallClockNow());

  useEffect(() => {
    const id = window.setInterval(() => setNow(taskWallClockNow()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!enabled || !userId) return 0;
    return countTasksInReminderWindow(tasks, userId, now, offsetMinutes);
  }, [enabled, userId, tasks, now, offsetMinutes]);
}
