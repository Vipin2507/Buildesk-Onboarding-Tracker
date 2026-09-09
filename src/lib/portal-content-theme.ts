/**
 * Read-only brand tokens for the Support Portal content area.
 * Values trace to the embed theme (--primary) and shared app CSS — do not invent colors here.
 */
import { PORTAL_CRM_EMBED_PRIMARY, PORTAL_PAGE_BACKGROUND } from "@/lib/portal-embed-theme";

/** Sidebar active / Support highlight blue (also set as --primary in embed mode). */
export const PORTAL_BRAND_BLUE = PORTAL_CRM_EMBED_PRIMARY;

/** Content foreground — matches embed navbar account name / sidebar labels. */
export const PORTAL_CONTENT_FOREGROUND = "#334155";

/** Dividers and card borders — matches embed shell. */
export const PORTAL_CONTENT_BORDER = "#e5e7eb";

/** Muted labels (stat strip, table headers). */
export const PORTAL_CONTENT_MUTED = "#64748b";

/** Page background inside the content outlet. */
export const PORTAL_CONTENT_BACKGROUND = PORTAL_PAGE_BACKGROUND;

/** Semantic tints derived from brand + app success/warning tokens. */
export const PORTAL_CONTENT_SEMANTIC = {
  openBg: "color-mix(in srgb, var(--primary) 10%, transparent)",
  openText: "var(--primary)",
  solvedBg: "color-mix(in srgb, var(--success) 12%, transparent)",
  solvedText: "var(--success)",
  mediumBg: "color-mix(in srgb, var(--warning) 15%, transparent)",
  mediumText: "var(--warning-foreground)",
} as const;
