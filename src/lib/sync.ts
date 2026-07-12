import { toast } from "sonner";

/** Fire-and-forget server mutation; surfaces failures without blocking UI. */
export function serverSync(label: string, fn: () => Promise<unknown>) {
  void fn().catch((e) => {
    console.error(`[sync:${label}]`, e);
    toast.error(e instanceof Error ? e.message : `Failed to sync ${label}`);
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
