import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CrmTasksHub } from "@/components/tasks/crm-tasks-hub";
import {
  crmTasksSearchSchema,
  parseCrmTasksTab,
  type CrmTasksTabId,
} from "@/lib/crm-route-search";

export const Route = createFileRoute("/crm/tasks")({
  validateSearch: (search) => crmTasksSearchSchema.parse(search),
  component: CrmTasksPage,
});

function CrmTasksPage() {
  const navigate = useNavigate({ from: "/crm/tasks" });
  const search = Route.useSearch();
  const tab = parseCrmTasksTab(search.tab);

  function setTab(next: CrmTasksTabId) {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: next === "all" ? undefined : next,
      }),
      replace: true,
    });
  }

  function setSelectedTask(taskId: string | undefined) {
    void navigate({
      search: (prev) => ({
        ...prev,
        taskId: taskId || undefined,
      }),
      replace: true,
    });
  }

  return (
    <CrmTasksHub
      tab={tab}
      onTabChange={setTab}
      selectedTaskId={search.taskId}
      onSelectTask={setSelectedTask}
    />
  );
}
