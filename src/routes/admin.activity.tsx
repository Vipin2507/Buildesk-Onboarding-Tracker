import { createFileRoute } from "@tanstack/react-router";

import { ActivityPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/activity")({
  component: ActivityPage,
});
