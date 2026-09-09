/** CSP frame-ancestors value for client portal pages embedded in external iframes. */
export function resolvePortalFrameAncestorsCsp(): string {
  const configured = process.env.PORTAL_FRAME_ANCESTORS?.trim();
  if (configured) return configured;
  return "*";
}

export function isPortalDocumentPath(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

/** Allow portal pages to load inside iframes on other sites (overrides X-Frame-Options in modern browsers). */
export function applyPortalIframeHeaders(response: Response, pathname: string): Response {
  if (!isPortalDocumentPath(pathname)) return response;

  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  headers.set("Content-Security-Policy", `frame-ancestors ${resolvePortalFrameAncestorsCsp()}`);
  headers.delete("X-Frame-Options");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
