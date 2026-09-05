import { toast } from "sonner";

export function isTransientFetchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /not found/i.test(message) ||
    /FOREIGN KEY constraint failed/i.test(message) ||
    /skipped/i.test(message) ||
    /company missing/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /network changed/i.test(message) ||
    /internet disconnected/i.test(message) ||
    /load failed/i.test(message) ||
    /do not have permission/i.test(message) ||
    /sign in required/i.test(message) ||
    /aborted/i.test(message)
  );
}

function isIgnorableSyncError(message: string) {
  return isTransientFetchError(new Error(message));
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

/**
 * Tracked sync with rollback — use for creates where optimistic UI must not lie
 * about persistence (permission errors included).
 */
export function serverSyncTrackedWithRollback(
  key: string,
  label: string,
  fn: () => Promise<unknown>,
  rollback: () => void | Promise<void>,
) {
  const run = Promise.resolve()
    .then(fn)
    .catch(async (e) => {
      const message = e instanceof Error ? e.message : `Failed to sync ${label}`;
      console.error(`[sync:${label}]`, e);
      try {
        await rollback();
      } catch (rollbackErr) {
        console.error(`[sync:${label}:rollback]`, rollbackErr);
      }
      toast.error(message, {
        description: "The company was not saved. Please try again or contact an administrator.",
      });
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
const pendingFns = new Map<string, () => Promise<unknown>>();

export function serverSyncDebounced(key: string, ms: number, fn: () => Promise<unknown>) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  pendingFns.set(key, fn);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const run = pendingFns.get(key);
      pendingFns.delete(key);
      if (run) serverSync(key, run);
    }, ms),
  );
}

/** Flush a pending debounced sync immediately (e.g. before unload / after critical writes). */
export function flushServerSyncDebounced(key: string) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.delete(key);
  const run = pendingFns.get(key);
  pendingFns.delete(key);
  if (run) serverSync(key, run);
}
