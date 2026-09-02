import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CrmQueriesHub } from "@/components/crm/crm-queries-hub";
import {
  crmQueriesSearchSchema,
  parseCrmQueriesStatus,
} from "@/lib/crm-route-search";

export const Route = createFileRoute("/crm/queries")({
  validateSearch: (search) => crmQueriesSearchSchema.parse(search),
  component: CrmQueriesPage,
});

function CrmQueriesPage() {
  const navigate = useNavigate({ from: "/crm/queries" });
  const search = Route.useSearch();
  const statusFilter = parseCrmQueriesStatus(search.status);

  function setStatusFilter(next: "all" | "open" | "resolved" | "archived") {
    void navigate({
      search: (prev) => ({
        ...prev,
        status: next === "all" ? undefined : next,
      }),
      replace: true,
    });
  }

  return (
    <CrmQueriesHub
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      selectedQueryId={search.queryId}
    />
  );
}
