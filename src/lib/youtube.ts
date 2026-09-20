/**
 * Extract a YouTube video ID from common URL formats.
 * Supports watch, youtu.be, embed, and shorts URLs.
 */
export function getYouTubeVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (embedIdx >= 0) {
        const id = parts[embedIdx + 1];
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    const watchMatch = raw.match(/[?&]v=([\w-]{11})/);
    if (watchMatch?.[1]) return watchMatch[1];
    const shortMatch = raw.match(/youtu\.be\/([\w-]{11})/);
    if (shortMatch?.[1]) return shortMatch[1];
  }

  return null;
}

export function getYouTubeThumbnailUrl(videoId: string, quality: "hq" | "mq" | "sd" = "hq") {
  const q = quality === "mq" ? "mqdefault" : quality === "sd" ? "sddefault" : "hqdefault";
  return `https://img.youtube.com/vi/${videoId}/${q}.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string, opts?: { startSeconds?: number }) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    playsinline: "1",
  });
  if (typeof window !== "undefined" && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  if (opts?.startSeconds && opts.startSeconds > 0) {
    params.set("start", String(Math.floor(opts.startSeconds)));
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Post a seek command to a YouTube iframe (requires enablejsapi=1). */
export function seekYouTubeIframe(iframe: HTMLIFrameElement | null, seconds: number) {
  if (!iframe?.contentWindow) return false;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "seekTo",
        args: [Math.max(0, Math.floor(seconds)), true],
      }),
      "*",
    );
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "playVideo",
        args: [],
      }),
      "*",
    );
    return true;
  } catch {
    return false;
  }
}
