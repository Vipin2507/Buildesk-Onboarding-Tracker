import { useRouterState } from "@tanstack/react-router";
import { useAuthStore, useCompanyStore } from "@/stores";
import { useEffect, useState } from "react";

export function RouterDebug() {
  const location = useRouterState({ select: (s) => s.location });
  const currentUserId = useAuthStore((s) => s.user?.id);
  const companiesCount = useCompanyStore((s) => s.companies.length);
  const [lastError, setLastError] = useState<string | null>(null);

  // Use the real URL query string; router search typing varies by route.
  const enabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";
  if (!enabled) return null;

  // Surface client runtime errors in the UI (useful when router recovers silently).
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const message = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
      setLastError(String(message));
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : event.reason;
      setLastError(String(reason));
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <div className="fixed bottom-3 left-3 z-[9999] max-w-[92vw] rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="font-semibold">Debug</div>
      <div>path: {location.pathname}</div>
      <div>search: {typeof window !== "undefined" ? window.location.search : ""}</div>
      <div>auth.currentUserId: {currentUserId ?? "null"}</div>
      <div>companies: {companiesCount}</div>
      {lastError && (
        <div className="mt-2 max-h-24 overflow-auto rounded border bg-destructive/5 p-2 font-mono text-[10px] text-destructive">
          {lastError}
        </div>
      )}
    </div>
  );
}

