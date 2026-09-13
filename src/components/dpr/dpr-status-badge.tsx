import { Pill } from "@/components/status-pill";
import type { DprStatus } from "@/types/dpr";

export function DprStatusBadge({ status }: { status: DprStatus }) {
  const tone =
    status === "Completed" ? "success" : status === "In Progress" ? "warning" : "danger";
  return <Pill tone={tone}>{status}</Pill>;
}
