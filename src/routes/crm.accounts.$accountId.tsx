import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { EntityNotFound } from "@/components/empty-state";
import { canViewCrmAccount } from "@/lib/crm-account-access";
import { useAuthStore, useCrmAccountStore, useCrmOnboardingStore } from "@/stores";

export const Route = createFileRoute("/crm/accounts/$accountId")({
  component: CrmAccountLayout,
});

function CrmAccountLayout() {
  const { accountId } = Route.useParams();
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const currentUser = useAuthStore((s) => s.user);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);

  useEffect(() => {
    if (!account) return;
    ensure(accountId, account.companyType);
  }, [account, accountId, ensure]);

  if (!account || !canViewCrmAccount(account, currentUser)) {
    return <EntityNotFound entity="CRM account" listPath="/crm/accounts" listLabel="Accounts" />;
  }

  return <Outlet />;
}
