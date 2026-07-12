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
  // crypto.randomUUID is secure-context only (HTTPS / localhost).
  // VPS access over http://IP needs a fallback.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
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
