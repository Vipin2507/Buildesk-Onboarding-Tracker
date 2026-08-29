import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ErpTasksHub } from "@/components/tasks/erp-tasks-hub";
import {
  erpTasksSearchSchema,
  parseErpTasksTab,
  type ErpTasksTabId,
} from "@/lib/erp-route-search";

export const Route = createFileRoute("/tasks")({
  validateSearch: (search) => erpTasksSearchSchema.parse(search),
  component: ErpTasksPage,
});

function ErpTasksPage() {
  const navigate = useNavigate({ from: "/tasks" });
  const search = Route.useSearch();
  const tab = parseErpTasksTab(search.tab);

  function setTab(next: ErpTasksTabId) {
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
    <ErpTasksHub
      tab={tab}
      onTabChange={setTab}
      selectedTaskId={search.taskId}
      onSelectTask={setSelectedTask}
    />
  );
}
