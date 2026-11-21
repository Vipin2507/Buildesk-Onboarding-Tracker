import { createFileRoute } from "@tanstack/react-router";

import { CrmPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/crm")({
  component: CrmPage,
});
