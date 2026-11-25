import { useEffect, useState } from "react";

import { setBrowserOffline, useOffline, recheckConnectivity } from "@/lib/native/shell-state";

export function ConnectionBanner() {
  const offline = useOffline();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setBrowserOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!mounted || !offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[70] border-b border-amber-700/30 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-300/20 dark:bg-amber-950 dark:text-amber-50"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-snug">
          No connection. Buildesk Compass can’t reach the server, so nothing you change is saved.
        </p>
        <button
          type="button"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white dark:bg-amber-200 dark:text-amber-950"
          disabled={checking}
          onClick={() => {
            setChecking(true);
            void recheckConnectivity().finally(() => setChecking(false));
          }}
        >
          {checking ? "Checking…" : "Check again"}
        </button>
      </div>
    </div>
  );
}
