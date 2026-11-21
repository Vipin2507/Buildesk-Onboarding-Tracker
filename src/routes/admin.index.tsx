import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});
