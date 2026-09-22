import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Basic email format check for forms (not full RFC validation). */
export function isValidEmail(value: string) {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const PLACEHOLDER_CONTACT_NAMES = new Set([
  "to be assigned",
  "owner tbd",
  "tbd",
  "n/a",
  "na",
  "none",
  "unassigned",
  "-",
  "--",
]);

/** Seed / import placeholders that should not autofill portal guest name. */
export function isPlaceholderContactName(name: string | null | undefined): boolean {
  const n = name?.trim().toLowerCase() ?? "";
  if (!n) return true;
  return PLACEHOLDER_CONTACT_NAMES.has(n);
}

/** Real contact name for portal autofill; empty when missing or placeholder. */
export function usableContactName(name: string | null | undefined): string {
  const n = name?.trim() ?? "";
  return isPlaceholderContactName(n) ? "" : n;
}

/** Portal phone: at least 10 digits (India mobile or similar). */
export function isValidPortalPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

/** Display YYYY-MM-DD (or ISO) as a readable local date. */
export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Display YYYY-MM-DD (or ISO) as DD/MM/YYYY on one line. */
export function formatDateDmy(value?: string | null) {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Display ISO as time only (e.g. 2:30 PM). */
export function formatTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Local calendar day key (YYYY-MM-DD) for grouping chat messages. */
export function localDateKey(value?: string | null) {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Chat date chip: Today / Yesterday / weekday + date. */
export function formatChatDateLabel(value?: string | null, now = new Date()) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return formatDate(value);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Display ISO as short date + time for checklist phase stamps. */
export function formatDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Indian Rupee display for commercial amounts. */
export function formatInr(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
