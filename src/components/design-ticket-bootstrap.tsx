import { useEffect } from "react";

import { useCompanyStore } from "@/stores/useCompanyStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";

/** Ensures every company has portal access once companies are loaded. */
export function DesignTicketBootstrap() {
  const companies = useCompanyStore((s) => s.companies);
  const ensureAll = useCompanyPortalStore((s) => s.ensureAllCompanies);

  useEffect(() => {
    if (companies.length > 0) ensureAll(companies);
  }, [companies, ensureAll]);

  return null;
}
