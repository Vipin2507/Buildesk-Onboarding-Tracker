import { createFileRoute } from "@tanstack/react-router";

import { CrmWinbackPanel } from "@/components/crm/crm-winback-panel";
import { PageWrap } from "@/components/page-header";

export const Route = createFileRoute("/crm/win-back")({
  component: CrmWinbackPage,
});

function CrmWinbackPage() {
  return (
    <PageWrap compact>
      <CrmWinbackPanel />
    </PageWrap>
  );
}
