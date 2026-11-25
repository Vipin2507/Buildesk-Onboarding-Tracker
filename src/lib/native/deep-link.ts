/** Accept only same-origin app paths and the buildeskcompass://app scheme. */
export function safeInAppPath(
  raw: string | null | undefined,
  currentOrigin?: string,
): string | null {
  if (!raw) return null;
  const input = raw.trim();
  if (!input || input.length > 2048) return null;

  let path = input;
  if (input.includes("://") || input.startsWith("//")) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }
    if (url.username || url.password) return null;

    if (url.protocol === "buildeskcompass:") {
      if (url.hostname && url.hostname !== "app") return null;
      path = `${url.pathname}${url.search}${safeHash(url.hash)}`;
    } else if (url.protocol === "https:" || url.protocol === "http:") {
      if (!currentOrigin) return null;
      let current: URL;
      try {
        current = new URL(currentOrigin);
      } catch {
        return null;
      }
      if (url.origin !== current.origin) return null;
      path = `${url.pathname}${url.search}${safeHash(url.hash)}`;
    } else {
      return null;
    }
  }

  if (!path.startsWith("/")) path = `/${path}`;
  if (!isSafeAppPath(path)) return null;
  return path;
}

function safeHash(hash: string) {
  if (!hash || hash.includes(":") || hash.includes("\\") || hash.includes("//")) return "";
  return hash;
}

function isSafeAppPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("\0")) return false;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("..")) return false;
  if (decoded.includes("://")) return false;
  const pathOnly = decoded.split("?")[0]?.split("#")[0] ?? decoded;
  if (pathOnly.includes(":")) return false;
  return true;
}

export function compareVersions(left: string, right: string) {
  const a = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}
