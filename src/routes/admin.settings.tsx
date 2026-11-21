import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});
