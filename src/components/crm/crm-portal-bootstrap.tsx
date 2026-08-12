import { useEffect, useRef } from "react";

import { useBookingStore, useCompanyPortalStore, useCrmAccountStore } from "@/stores";

/**
 * Ensures CRM accounts missing portal rows get one created (once per mount wave).
 * Also seeds default booking event type + host availability when portal exists.
 */
export function CrmPortalBootstrap() {
  const accounts = useCrmAccountStore((s) => s.accounts);
  const generateAccess = useCompanyPortalStore((s) => s.generateAccessForCompany);
  const getByCompanyId = useCompanyPortalStore((s) => s.getByCompanyId);
  const ensureDefaults = useBookingStore((s) => s.ensureDefaults);
  const attempted = useRef(new Set<string>());
  const bookingAttempted = useRef(new Set<string>());

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

  useEffect(() => {
    for (const account of accounts) {
      if (bookingAttempted.current.has(account.id)) continue;
      if (!getByCompanyId(account.id)) continue;
      bookingAttempted.current.add(account.id);
      void ensureDefaults(account.id).catch((e) =>
        console.warn("[booking bootstrap]", account.id, e),
      );
    }
  }, [accounts, ensureDefaults, getByCompanyId]);

  return null;
}
