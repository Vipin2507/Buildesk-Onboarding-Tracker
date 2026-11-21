import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});
