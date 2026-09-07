import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/companies/$companyId/modules/post-sales/projects/$projectId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId",
      params: { projectId: params.projectId },
      search: { tab: "onboarding" },
    });
  },
  component: () => null,
});
