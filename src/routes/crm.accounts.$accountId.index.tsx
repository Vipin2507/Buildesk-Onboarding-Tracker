import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { CrmOnboardingHub } from "@/components/crm/crm-onboarding-hub";
import { calcCrmOnboardingProgress } from "@/data/crm-onboarding-defaults";
import {
  crmAccountSearchSchema,
  parseCrmAccountTab,
  type CrmAccountTabId,
  type CrmSalesCrmSectionId,
} from "@/lib/crm-route-search";
import { useCrmAccountStore, useCrmOnboardingStore } from "@/stores";

const LEGACY_SALES_CRM_TAB_SECTIONS: Record<string, CrmSalesCrmSectionId> = {
  integrations: "integrations",
  masters: "masters",
  migration: "migration",
  training: "training",
  reports: "reports",
};

export const Route = createFileRoute("/crm/accounts/$accountId/")({
  validateSearch: (search) => crmAccountSearchSchema.parse(search),
  beforeLoad: ({ params, search }) => {
    const tab = (search as { tab?: string }).tab;
    const section = tab ? LEGACY_SALES_CRM_TAB_SECTIONS[tab] : undefined;
    if (section) {
      throw redirect({
        to: "/crm/accounts/$accountId/modules/$moduleKey",
        params: { accountId: params.accountId, moduleKey: "sales-crm" },
        search: { section },
      });
    }
  },
  component: CrmAccountHubPage,
});

function CrmAccountHubPage() {
  const navigate = useNavigate();
  const { accountId } = Route.useParams();
  const { tab: tabParam, queryId } = Route.useSearch();
  const tab = parseCrmAccountTab(tabParam);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));

  if (!account) return null;

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
