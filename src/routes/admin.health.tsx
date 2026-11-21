import { createFileRoute } from "@tanstack/react-router";

import { HealthPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/health")({
  component: HealthPage,
});
