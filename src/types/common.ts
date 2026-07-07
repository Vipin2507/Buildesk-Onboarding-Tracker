export type StatusKey = "not_started" | "in_progress" | "review" | "completed" | "on_hold";

export const STATUS_LABEL: Record<StatusKey, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  review: "Pending Review",
  completed: "Completed",
  on_hold: "On Hold",
};

export type Timestamps = {
  createdAt: string;
  updatedAt: string;
};

export type ActivityKind = "success" | "info" | "warning" | "danger";

export type ActivityEntry = Timestamps & {
  id: string;
  who: string;
  what: string;
  kind: ActivityKind;
  companyId?: string;
  projectId?: string;
};

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
