import { useEffect, useState, type ReactNode } from "react";
import { rehydrateAllStores } from "@/stores/rehydrate";

export function StoreHydrationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    rehydrateAllStores()
      .catch((error) => {
        console.warn("[buildesk] Store rehydration failed, using seed data", error);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Buildesk…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
