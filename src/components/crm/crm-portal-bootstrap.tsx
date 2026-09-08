import { useEffect, useRef } from "react";

import { useAuthStore, useBookingStore, useCompanyPortalStore, useCrmAccountStore } from "@/stores";

/**
 * Ensures CRM accounts missing portal rows get one created (once per mount wave).
 * Waits for server portal hydrate so we don't overwrite bulk-uploaded API keys with random slugs.
 */
export function CrmPortalBootstrap() {
  const user = useAuthStore((s) => s.user);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const serverHydrated = useCompanyPortalStore((s) => s.serverHydrated);
  const ensurePortalForCompany = useCompanyPortalStore((s) => s.ensurePortalForCompany);
  const getByCompanyId = useCompanyPortalStore((s) => s.getByCompanyId);
  const ensureDefaultsBatch = useBookingStore((s) => s.ensureDefaultsBatch);
  const attempted = useRef(new Set<string>());
  const bookingBatchKey = useRef<string | null>(null);

  useEffect(() => {
    if (!serverHydrated) return;

    for (const account of accounts) {
      if (attempted.current.has(account.id)) continue;
      if (getByCompanyId(account.id)) {
        attempted.current.add(account.id);
        continue;
      }
      attempted.current.add(account.id);
      void ensurePortalForCompany({
        id: account.id,
        name: account.name,
        contact: account.contact,
        email: account.email,
      }).catch((e) => console.warn("[crm portal bootstrap]", e));
    }
  }, [accounts, ensurePortalForCompany, getByCompanyId, serverHydrated]);

  useEffect(() => {
    if (!user) return;
    const withPortal = accounts.filter((a) => getByCompanyId(a.id)).map((a) => a.id);
    if (withPortal.length === 0) return;
    const key = `${user.id}:${withPortal.slice().sort().join(",")}`;
    if (bookingBatchKey.current === key) return;
    bookingBatchKey.current = key;
    void ensureDefaultsBatch(withPortal).catch((e) => {
      // Allow retry on next accounts/user change if this batch failed.
      if (bookingBatchKey.current === key) bookingBatchKey.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (/sign in required/i.test(msg)) return;
      console.warn("[booking bootstrap]", e);
    });
  }, [accounts, ensureDefaultsBatch, getByCompanyId, user]);

  return null;
}
