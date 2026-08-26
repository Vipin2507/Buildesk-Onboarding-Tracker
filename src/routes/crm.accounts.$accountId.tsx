import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CrmOnboardingHub } from "@/components/crm/crm-onboarding-hub";
import { EntityNotFound } from "@/components/empty-state";
import { calcCrmOnboardingProgress } from "@/data/crm-onboarding-defaults";
import { canViewCrmAccount } from "@/lib/crm-account-access";
import {
  crmAccountSearchSchema,
  parseCrmAccountTab,
  type CrmAccountTabId,
} from "@/lib/crm-route-search";
import { useAuthStore, useCrmAccountStore, useCrmOnboardingStore } from "@/stores";

export const Route = createFileRoute("/crm/accounts/$accountId")({
  validateSearch: (search) => crmAccountSearchSchema.parse(search),
  component: CrmAccountDetailPage,
});

function CrmAccountDetailPage() {
  const navigate = useNavigate();
  const { accountId } = Route.useParams();
  const { tab: tabParam } = Route.useSearch();
  const tab = parseCrmAccountTab(tabParam);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const currentUser = useAuthStore((s) => s.user);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);

  if (!account || !canViewCrmAccount(account, currentUser)) {
    return <EntityNotFound entity="CRM account" listPath="/crm/accounts" listLabel="Accounts" />;
  }

  const record = ensure(accountId, account.companyType);
  const progress = calcCrmOnboardingProgress(record);

  function setTab(next: CrmAccountTabId) {
    void navigate({
      to: "/crm/accounts/$accountId",
      params: { accountId },
      search: next === "dashboard" ? {} : { tab: next },
      replace: true,
    });
  }

  return (
    <CrmOnboardingHub
      accountId={accountId}
      accountName={account.name}
      progress={progress}
      tab={tab}
      onTabChange={setTab}
    />
  );
}
