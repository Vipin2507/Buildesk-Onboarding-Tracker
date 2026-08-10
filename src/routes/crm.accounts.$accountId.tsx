import { createFileRoute } from "@tanstack/react-router";

import { CrmOnboardingHub } from "@/components/crm/crm-onboarding-hub";
import { EntityNotFound } from "@/components/empty-state";
import { calcCrmOnboardingProgress } from "@/data/crm-onboarding-defaults";
import { canViewCrmAccount } from "@/lib/crm-account-access";
import { useAuthStore, useCrmAccountStore, useCrmOnboardingStore } from "@/stores";

export const Route = createFileRoute("/crm/accounts/$accountId")({
  component: CrmAccountDetailPage,
});

function CrmAccountDetailPage() {
  const { accountId } = Route.useParams();
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const currentUser = useAuthStore((s) => s.user);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);

  if (!account || !canViewCrmAccount(account, currentUser)) {
    return <EntityNotFound entity="CRM account" listPath="/crm/accounts" listLabel="Accounts" />;
  }

  const record = ensure(accountId, account.companyType);
  const progress = calcCrmOnboardingProgress(record);

  return (
    <CrmOnboardingHub accountId={accountId} accountName={account.name} progress={progress} />
  );
}
