import { createFileRoute } from "@tanstack/react-router";

import { AuditPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});
