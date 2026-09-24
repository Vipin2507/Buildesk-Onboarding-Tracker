import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export type AcademyYouTubePlayerHandle = {
  seekTo: (seconds: number) => boolean;
};

type AcademyYouTubePlayerProps = {
  videoId: string;
  title: string;
  className?: string;
  onPlayingChange?: (playing: boolean) => void;
};

const YT_ORIGIN = "https://www.youtube.com";

/**
 * Native YouTube embed for Buildesk Academy.
 *
 * Custom chromeless overlays + pointer-events:none break inside nested iframes
 * (parent site → portal → YouTube): clicks never reach play. Native controls work.
 * Transcript seek uses postMessage (enablejsapi=1).
 */
export const AcademyYouTubePlayer = forwardRef<
  AcademyYouTubePlayerHandle,
  AcademyYouTubePlayerProps
>(function AcademyYouTubePlayer({ videoId, title, className, onPlayingChange }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number) {
        const win = iframeRef.current?.contentWindow;
        if (!win) return false;
        const next = Math.max(0, Math.floor(seconds));
        try {
          // YouTube IFrame API command protocol (works without loading widget API).
          win.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [next, true] }),
            YT_ORIGIN,
          );
          win.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            YT_ORIGIN,
          );
          onPlayingChange?.(true);
          return true;
        } catch {
          return false;
        }
      },
    }),
    [onPlayingChange],
  );

  // Listen for player state so parents can react (optional).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== YT_ORIGIN && event.origin !== "https://www.youtube-nocookie.com") {
        return;
      }
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const payload = data as { event?: string; info?: number };
      if (payload.event !== "onStateChange" || typeof payload.info !== "number") return;
      // 1 = playing, 3 = buffering
      onPlayingChange?.(payload.info === 1 || payload.info === 3);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPlayingChange]);

  // Subscribe to state updates once the iframe can receive commands.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    function subscribe() {
      iframe?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: videoId }),
        YT_ORIGIN,
      );
    }
    iframe.addEventListener("load", subscribe);
    return () => iframe.removeEventListener("load", subscribe);
  }, [videoId]);

  const src = getYouTubeEmbedUrl(videoId);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-zinc-950",
        className,
      )}
    >
      <iframe
        ref={iframeRef}
        key={videoId}
        title={title}
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
});
