import { useEffect, useRef } from "react";

import { useCompanyPortalStore, useCrmAccountStore } from "@/stores";

/**
 * Ensures CRM accounts missing portal rows get one created (once per mount wave).
 * Skips accounts that already have portal access to avoid request storms.
 */
export function CrmPortalBootstrap() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const getByCompanyId = useCompanyPortalStore((s) => s.getByCompanyId);
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    for (const account of accounts) {
      if (attempted.current.has(account.id)) continue;
      if (getByCompanyId(account.id)) {
        attempted.current.add(account.id);
        continue;
      }
      attempted.current.add(account.id);
      generateAccess({
        id: account.id,
        name: account.name,
        contact: account.contact,
        email: account.email,
      });
    }
  }, [accounts, generateAccess, getByCompanyId]);

  return null;
}
