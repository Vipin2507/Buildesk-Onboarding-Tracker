import { createFileRoute } from "@tanstack/react-router";

import { AttendancePage } from "@/components/command-center/pages";

export const Route = createFileRoute("/admin/attendance")({
  component: AttendancePage,
});
