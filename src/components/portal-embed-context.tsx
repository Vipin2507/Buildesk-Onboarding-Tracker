import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { detectPortalEmbedMode } from "@/lib/portal-embed-mode";

type PortalEmbedContextValue = {
  embedded: boolean;
};

const PortalEmbedContext = createContext<PortalEmbedContextValue>({ embedded: false });

export function PortalEmbedProvider({ children }: { children: ReactNode }) {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(detectPortalEmbedMode());
  }, []);

  const value = useMemo(() => ({ embedded }), [embedded]);

  return <PortalEmbedContext.Provider value={value}>{children}</PortalEmbedContext.Provider>;
}

export function usePortalEmbedMode() {
  return useContext(PortalEmbedContext).embedded;
}
