/**
 * Public app origin for absolute links in email / WhatsApp (CRM deep links).
 * Prefer APP_BASE_URL, then VITE_PORTAL_BASE_URL (same host in production), then browser origin.
 */
export function getAppBaseUrl(): string {
  if (typeof process !== "undefined") {
    const fromApp = process.env.APP_BASE_URL?.trim();
    if (fromApp) return fromApp.replace(/\/+$/, "");
    const fromPortalEnv = process.env.VITE_PORTAL_BASE_URL?.trim();
    if (fromPortalEnv) return fromPortalEnv.replace(/\/+$/, "");
  }

  try {
    const fromVite = (import.meta.env.VITE_PORTAL_BASE_URL as string | undefined)?.trim();
    if (fromVite) return fromVite.replace(/\/+$/, "");
  } catch {
    /* import.meta may be unavailable in some Node contexts */
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
}

/** Join base + path into an absolute URL; returns the path if base is unset. */
export function absoluteAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getAppBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
