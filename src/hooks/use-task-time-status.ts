import { useEffect, useMemo, useState } from "react";

import { syncErpFollowUpTaskStatuses, syncFollowUpTaskStatuses } from "@/lib/api";
import { applyAutoTaskStatus, taskWallClockNow } from "@/lib/task-scheduling";
import { useCrmTaskStore } from "@/stores/useCrmTaskStore";
import { useErpTaskStore } from "@/stores/useErpTaskStore";
import type { FollowUpTask, TaskProductScope } from "@/types";

const SYNC_MS = 30_000;
const TICK_MS = 15_000;

/** Keep task statuses in sync with scheduled start/end times (client display + server persist). */
export function useTaskTimeStatusSync(enabled = true, scope: TaskProductScope = "crm") {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const store = scope === "erp" ? useErpTaskStore : useCrmTaskStore;
    const syncFn = scope === "erp" ? syncErpFollowUpTaskStatuses : syncFollowUpTaskStatuses;

    async function run() {
      try {
        const updated = await syncFn({ data: {} });
        if (cancelled || updated.length === 0) return;
        store.setState((state) => {
          const byId = new Map(updated.map((task) => [task.id, task]));
          return {
            tasks: state.tasks.map((task) => byId.get(task.id) ?? task),
          };
        });
      } catch {
        // Non-blocking — next interval or page refresh will retry.
      }
    }

    void run();
    const id = window.setInterval(() => void run(), SYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, scope]);
}

/** Derive in_progress from schedule between server sync ticks. */
export function useTasksWithTimeStatus(tasks: FollowUpTask[]): FollowUpTask[] {
  const [now, setNow] = useState(() => taskWallClockNow());

  useEffect(() => {
    const id = window.setInterval(() => setNow(taskWallClockNow()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(
    () => tasks.map((task) => applyAutoTaskStatus(task, now)),
    [tasks, now],
  );
}

export function taskStatusTone(
  status: FollowUpTask["status"],
): "success" | "warning" | "danger" | "muted" | "info" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "blocked") return "warning";
  if (status === "in_progress") return "info";
  return "muted";
}
