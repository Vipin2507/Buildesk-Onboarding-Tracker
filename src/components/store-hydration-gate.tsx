import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { rehydrateAllStores } from "@/stores/rehydrate";

export function StoreHydrationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    rehydrateAllStores()
      .catch((error) => {
        console.warn("[buildesk] Store rehydration failed", error);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return <AppLoadingScreen message="Starting Buildesk…" />;
  }

  return <>{children}</>;
}
