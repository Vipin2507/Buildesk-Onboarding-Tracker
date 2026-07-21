/** Public-facing base URL shown in copyable links (placeholder per spec). */
export const PORTAL_PUBLIC_BASE_URL = "https://track.buildesk.com";

export function portalPublicCreateUrl(slug: string) {
  return `${PORTAL_PUBLIC_BASE_URL}/create-ticket/${slug}`;
}

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
