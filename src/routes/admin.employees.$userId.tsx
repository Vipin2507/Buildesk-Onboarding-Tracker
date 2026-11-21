import { createFileRoute } from "@tanstack/react-router";

import { EmployeeProfilePage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/employees/$userId")({
  component: EmployeeRoute,
});

function EmployeeRoute() {
  const { userId } = Route.useParams();
  return <EmployeeProfilePage userId={userId} />;
}
