import { createFileRoute } from "@tanstack/react-router";

import { SecurityPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
});
