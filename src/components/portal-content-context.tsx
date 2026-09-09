import { createContext, useContext, type ReactNode } from "react";

const PortalContentContext = createContext(false);

/** Marks portal main-outlet content (dashboard, tickets, etc.) — not navbar/sidebar chrome. */
export function PortalContentScope({ children }: { children: ReactNode }) {
  return (
    <PortalContentContext.Provider value={true}>
      <div className="portal-content">{children}</div>
    </PortalContentContext.Provider>
  );
}

export function usePortalContentScope() {
  return useContext(PortalContentContext);
}
