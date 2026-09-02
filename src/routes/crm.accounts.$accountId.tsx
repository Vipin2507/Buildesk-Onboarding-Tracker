import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

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
  const { tab: tabParam, queryId } = Route.useSearch();
  const tab = parseCrmAccountTab(tabParam);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));
  const currentUser = useAuthStore((s) => s.user);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);

  useEffect(() => {
    if (!account) return;
    ensure(accountId, account.companyType);
  }, [account, accountId, ensure]);

  if (!account || !canViewCrmAccount(account, currentUser)) {
    return <EntityNotFound entity="CRM account" listPath="/crm/accounts" listLabel="Accounts" />;
  }

  const progress = record ? calcCrmOnboardingProgress(record) : 0;

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
      initialQueryId={queryId}
    />
  );
}
