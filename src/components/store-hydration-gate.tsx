import { useEffect, type ReactNode } from "react";

import { rehydrateAllStores } from "@/stores/rehydrate";

export function StoreHydrationGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    void rehydrateAllStores().catch((error) => {
      console.warn("[buildesk] Store rehydration failed", error);
    });
  }, []);

  return <>{children}</>;
}
