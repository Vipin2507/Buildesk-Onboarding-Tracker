/** CSP frame-ancestors value for client portal pages embedded in external iframes. */
export function resolvePortalFrameAncestorsCsp(): string {
  const configured = process.env.PORTAL_FRAME_ANCESTORS?.trim();
  if (configured) return configured;
  return "*";
}

export function isPortalDocumentPath(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

function mergeFrameAncestorsCsp(existing: string | null, ancestors: string): string {
  if (!existing?.trim()) return `frame-ancestors ${ancestors}`;
  if (/frame-ancestors\s/i.test(existing)) {
    return existing.replace(/frame-ancestors\s[^;]*/i, `frame-ancestors ${ancestors}`);
  }
  return `${existing.trim().replace(/;+\s*$/, "")}; frame-ancestors ${ancestors}`;
}

/** Allow portal pages to load inside iframes on other sites (overrides X-Frame-Options in modern browsers). */
export function applyPortalIframeHeaders(response: Response, pathname: string): Response {
  if (!isPortalDocumentPath(pathname)) return response;

  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";
  // Apply for HTML and redirects to portal HTML (some proxies omit content-type).
  if (contentType && !contentType.includes("text/html") && response.status < 300) return response;

  const ancestors = resolvePortalFrameAncestorsCsp();
  headers.set(
    "Content-Security-Policy",
    mergeFrameAncestorsCsp(headers.get("Content-Security-Policy"), ancestors),
  );
  headers.delete("X-Frame-Options");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
