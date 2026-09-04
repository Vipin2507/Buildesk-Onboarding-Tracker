import { createFileRoute, redirect } from "@tanstack/react-router";

import { CrmAccountModulePage } from "@/components/crm/crm-account-module-page";
import { EmptyState } from "@/components/empty-state";
import { isCrmCoreModule, isCrmIntegrationModule } from "@/data/crm-onboarding-defaults";
import {
  crmAccountModuleSearchSchema,
} from "@/lib/crm-route-search";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

export const Route = createFileRoute("/crm/accounts/$accountId/modules/$moduleKey")({
  validateSearch: (search) => crmAccountModuleSearchSchema.parse(search),
  beforeLoad: ({ params }) => {
    if (isCrmIntegrationModule(params.moduleKey as CrmProductModuleKey)) {
      throw redirect({
        to: "/crm/accounts/$accountId/modules/$moduleKey",
        params: { accountId: params.accountId, moduleKey: "sales-crm" },
        search: { section: "integrations" },
      });
    }
  },
  component: CrmAccountModuleRoutePage,
});

function CrmAccountModuleRoutePage() {
  const { accountId, moduleKey } = Route.useParams();
  const { section } = Route.useSearch();
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(accountId));
  const module = record?.productModules.find((m) => m.key === moduleKey);

  if (!isCrmCoreModule(moduleKey as CrmProductModuleKey)) {
    return (
      <EmptyState
        title="Unknown module"
        description="This module is not part of the CRM product catalog."
      />
    );
  }

  if (!module?.enabled) {
    return (
      <EmptyState
        title="Module not subscribed"
        description="Subscribe to this module from the account Modules tab first."
      />
    );
  }

  return (
    <CrmAccountModulePage
      accountId={accountId}
      moduleKey={moduleKey as CrmProductModuleKey}
      section={section}
    />
  );
}
