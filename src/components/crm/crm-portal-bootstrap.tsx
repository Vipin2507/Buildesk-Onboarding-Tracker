import { useEffect } from "react";

import { useCompanyPortalStore, useCrmAccountStore } from "@/stores";

/** Ensures every CRM account has portal access persisted to the server. */
export function CrmPortalBootstrap() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);

  useEffect(() => {
    for (const account of accounts) {
      generateAccess({
        id: account.id,
        name: account.name,
        contact: account.contact,
        email: account.email,
      });
    }
  }, [accounts, generateAccess]);

  return null;
}
