import { toast } from "sonner";

function isIgnorableSyncError(message: string) {
  return (
    /not found/i.test(message) ||
    /FOREIGN KEY constraint failed/i.test(message) ||
    /skipped/i.test(message) ||
    /company missing/i.test(message)
  );
}

const pending = new Map<string, Promise<unknown>>();

/** Track an in-flight sync so dependents can await it (e.g. project → company). */
export function serverSyncTracked(key: string, label: string, fn: () => Promise<unknown>) {
  const run = Promise.resolve()
    .then(fn)
    .catch((e) => {
      const message = e instanceof Error ? e.message : `Failed to sync ${label}`;
      if (isIgnorableSyncError(message)) {
        console.warn(`[sync:${label}]`, message);
        return;
      }
      console.error(`[sync:${label}]`, e);
      toast.error(message);
      throw e;
    })
    .finally(() => {
      if (pending.get(key) === run) pending.delete(key);
    });
  pending.set(key, run);
  return run;
}

export function waitForSync(key: string): Promise<void> {
  const p = pending.get(key);
  if (!p) return Promise.resolve();
  return p.then(() => undefined).catch(() => undefined);
}

/** Fire-and-forget server mutation; surfaces failures without blocking UI. */
export function serverSync(label: string, fn: () => Promise<unknown>) {
  void fn().catch((e) => {
    const message = e instanceof Error ? e.message : `Failed to sync ${label}`;
    // Cascade deletes / racey import syncs often hit these — not user-actionable.
    if (isIgnorableSyncError(message)) {
      console.warn(`[sync:${label}]`, message);
      return;
    }
    console.error(`[sync:${label}]`, e);
    toast.error(message);
  });
}

/**
 * Optimistic write with rollback: on non-ignorable failure, restore prior state
 * (or refetch) so the UI does not lie about persistence.
 */
export function serverSyncWithRollback(
  label: string,
  fn: () => Promise<unknown>,
  rollback: () => void | Promise<void>,
) {
  void fn().catch(async (e) => {
    const message = e instanceof Error ? e.message : `Failed to sync ${label}`;
    if (isIgnorableSyncError(message)) {
      console.warn(`[sync:${label}]`, message);
      return;
    }
    console.error(`[sync:${label}]`, e);
    try {
      await rollback();
    } catch (rollbackErr) {
      console.error(`[sync:${label}:rollback]`, rollbackErr);
    }
    toast.error(message, { description: "Local change was reverted." });
  });
}

/** Debounced sync for bulk config blobs (master / settings). */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function serverSyncDebounced(key: string, ms: number, fn: () => Promise<unknown>) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      serverSync(key, fn);
    }, ms),
  );
}
