/** In-app route for the client portal create-ticket page. */
export function portalCreatePath(slug: string) {
  return `/portal/${slug}/create-ticket`;
}

export function portalDashboardPath(slug: string) {
  return `/portal/${slug}/dashboard`;
}

export function portalTicketPath(slug: string, ticketId: string) {
  return `/portal/${slug}/tickets/${ticketId}`;
}

/**
 * Base URL for shareable client portal links.
 * Prefer VITE_PORTAL_BASE_URL (set in .env / .env.production for your VPS or domain).
 * Falls back to the browser origin when opening the app (e.g. http://200.97.166.244).
 */
export function getPortalBaseUrl(): string {
  const configured = import.meta.env.VITE_PORTAL_BASE_URL as string | undefined;
  if (configured?.trim()) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Full copyable URL clients can open to create a ticket. */
export function portalPublicCreateUrl(slug: string): string {
  const path = portalCreatePath(slug);
  const base = getPortalBaseUrl();
  return base ? `${base}${path}` : path;
}

export function portalPublicDashboardUrl(slug: string): string {
  const path = portalDashboardPath(slug);
  const base = getPortalBaseUrl();
  return base ? `${base}${path}` : path;
}

export function generatePortalSlug(existing: string[]) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let slug = "";
    for (let i = 0; i < 8; i++) {
      slug += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existing.includes(slug)) return slug;
  }
  return `co-${Date.now().toString(36).slice(-6)}`;
}
