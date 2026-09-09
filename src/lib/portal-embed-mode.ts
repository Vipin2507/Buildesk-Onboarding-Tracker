/** Query keys that enable chromeless portal layout for iframe / CRM embeds. */
const EMBED_ON = new Set(["1", "true", "yes"]);
const EMBED_OFF = new Set(["0", "false", "no"]);

function readEmbedSearchParam(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("embed");
  if (raw == null) return null;
  const value = raw.trim().toLowerCase();
  if (EMBED_ON.has(value)) return true;
  if (EMBED_OFF.has(value)) return false;
  return null;
}

/** True when the portal should render without its own sidebar / top bar (CRM iframe embed). */
export function detectPortalEmbedMode(): boolean {
  const fromQuery = readEmbedSearchParam();
  if (fromQuery != null) return fromQuery;
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent — treat as embedded.
    return true;
  }
}

/** Append `embed=1` for iframe src URLs (optional; auto-detect works without it). */
export function withPortalEmbedParam(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    if (!parsed.searchParams.has("embed")) {
      parsed.searchParams.set("embed", "1");
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}embed=1`;
  }
}
