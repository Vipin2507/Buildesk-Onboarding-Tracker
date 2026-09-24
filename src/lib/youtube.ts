/**
 * YouTube helpers + IFrame API loader for chromeless custom players.
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

export function getYouTubeEmbedUrl(videoId: string, opts?: { startSeconds?: number; chromeless?: boolean }) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    playsinline: "1",
    fs: "1",
  });
  if (opts?.chromeless) {
    params.set("controls", "0");
    params.set("fs", "0");
    params.set("iv_load_policy", "3");
    params.set("cc_load_policy", "0");
    params.set("disablekb", "1");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  if (opts?.startSeconds && opts.startSeconds > 0) {
    params.set("start", String(Math.floor(opts.startSeconds)));
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function formatYouTubeTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Minimal YouTube IFrame API surface used by the academy player. */
export type YouTubePlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume?: (volume: number) => void;
  getVolume?: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement;
  loadModule?: (module: string) => void;
  unloadModule?: (module: string) => void;
  setOption?: (module: string, option: string, value: unknown) => void;
  getOption?: (module: string, option: string) => unknown;
  getOptions?: (module?: string) => unknown;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YouTubePlayerInstance }) => void;
        onStateChange?: (e: { data: number; target: YouTubePlayerInstance }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API failed to initialize"));
    };

    if (!document.querySelector('script[data-youtube-iframe-api="1"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.youtubeIframeApi = "1";
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("Failed to load YouTube API"));
      };
      document.head.appendChild(script);
    }

    // API may already be mid-load from another caller
    const start = Date.now();
    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll);
        resolve(window.YT);
      } else if (Date.now() - start > 15000) {
        window.clearInterval(poll);
        apiPromise = null;
        reject(new Error("Timed out loading YouTube API"));
      }
    }, 50);
  });

  return apiPromise;
}

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** postMessage fallback when Player API play/pause is blocked (nested iframes). */
export function postYouTubeCommand(
  player: YouTubePlayerInstance | null | undefined,
  func: string,
  args: unknown[] = [],
) {
  try {
    const iframe = player?.getIframe?.();
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
    return Boolean(iframe?.contentWindow);
  } catch {
    return false;
  }
}

const YOUTUBE_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";

/** Ensure the YT iframe declares autoplay/fullscreen permissions (needed inside parent embeds). */
export function hardenYouTubeIframe(player: YouTubePlayerInstance | null | undefined) {
  try {
    const iframe = player?.getIframe?.();
    if (!iframe) return;
    iframe.setAttribute("allow", YOUTUBE_IFRAME_ALLOW);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("playsinline", "true");
  } catch {
    /* ignore */
  }
}

/** Play via API + postMessage; optional mute kickstart for nested-iframe autoplay policies. */
export function playYouTubePlayer(
  player: YouTubePlayerInstance | null | undefined,
  opts?: { muteFirst?: boolean },
) {
  if (!player) return;
  try {
    if (opts?.muteFirst) {
      player.mute();
      player.setVolume?.(0);
    }
    player.playVideo();
  } catch {
    /* fall through to postMessage */
  }
  if (opts?.muteFirst) {
    postYouTubeCommand(player, "mute");
    postYouTubeCommand(player, "setVolume", [0]);
  }
  postYouTubeCommand(player, "playVideo");
}

export function pauseYouTubePlayer(player: YouTubePlayerInstance | null | undefined) {
  if (!player) return;
  try {
    player.pauseVideo();
  } catch {
    /* fall through */
  }
  postYouTubeCommand(player, "pauseVideo");
}

export function isYouTubePlayerActivelyPlaying(player: YouTubePlayerInstance | null | undefined) {
  if (!player) return false;
  try {
    const state = player.getPlayerState();
    return state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
  } catch {
    return false;
  }
}

/** Mute via API + postMessage + volume 0 (nested iframes often ignore mute alone). */
export function muteYouTubePlayer(player: YouTubePlayerInstance | null | undefined) {
  if (!player) return;
  try {
    player.mute();
    player.setVolume?.(0);
  } catch {
    /* fall through */
  }
  postYouTubeCommand(player, "mute");
  postYouTubeCommand(player, "setVolume", [0]);
}

/** Unmute via API + postMessage + restore volume (needed after mute-to-play kickstarts). */
export function unmuteYouTubePlayer(player: YouTubePlayerInstance | null | undefined) {
  if (!player) return;
  try {
    player.unMute();
    player.setVolume?.(100);
  } catch {
    /* fall through */
  }
  postYouTubeCommand(player, "unMute");
  postYouTubeCommand(player, "setVolume", [100]);
}

export function readYouTubeMuted(
  player: YouTubePlayerInstance | null | undefined,
  fallback = false,
) {
  if (!player) return fallback;
  try {
    if (player.isMuted()) return true;
    const volume = player.getVolume?.();
    if (typeof volume === "number" && volume <= 0) return true;
    return false;
  } catch {
    return fallback;
  }
}
