import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  formatYouTubeTime,
  getYouTubeThumbnailUrl,
  hardenYouTubeIframe,
  isYouTubePlayerActivelyPlaying,
  loadYouTubeIframeApi,
  muteYouTubePlayer,
  pauseYouTubePlayer,
  playYouTubePlayer,
  postYouTubeCommand,
  unmuteYouTubePlayer,
  YT_PLAYER_STATE,
  type YouTubePlayerInstance,
} from "@/lib/youtube";
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

/**
 * Chromeless YouTube player for Buildesk Academy.
 *
 * Nested iframe policy (parent site → portal → YouTube):
 * - Unmuted play/unmute outside a direct click is blocked and often PAUSES the video.
 * - So we always start muted inside embeds (one click = play), then unmute only inside
 *   the mute button click — same gesture also calls playVideo().
 * - Never call unmute from onStateChange.
 */
export const AcademyYouTubePlayer = forwardRef<
  AcademyYouTubePlayerHandle,
  AcademyYouTubePlayerProps
>(function AcademyYouTubePlayer({ videoId, title, className, onPlayingChange }, ref) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const pollRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const userMutedRef = useRef(true);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const setPlayingState = useCallback(
    (next: boolean) => {
      playingRef.current = next;
      setPlaying(next);
      onPlayingChange?.(next);
    },
    [onPlayingChange],
  );

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrent(p.getCurrentTime() || 0);
        const d = p.getDuration();
        if (d && Number.isFinite(d)) setDuration(d);
      } catch {
        /* ignore */
      }
    }, 250);
  }, [stopPoll]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playingRef.current) setControlsVisible(false);
    }, 2800);
  }, []);

  /**
   * Start / resume from a click gesture.
   * Respect user mute preference — do not re-mute after they've unmuted.
   * First play in embeds starts with userMutedRef=true (set on mount).
   */
  const requestPlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    if (userMutedRef.current) {
      muteYouTubePlayer(p);
      playYouTubePlayer(p, { muteFirst: true });
      setMuted(true);
    } else {
      // Play button click = user gesture → sound is allowed; keep playback alive.
      unmuteYouTubePlayer(p);
      playYouTubePlayer(p);
      setMuted(false);
    }

    setStarted(true);
    setPlayingState(true);
    startPoll();
    revealControls();
  }, [revealControls, setPlayingState, startPoll]);

  const requestPause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    pauseYouTubePlayer(p);
    setPlayingState(false);
    stopPoll();
    setControlsVisible(true);
  }, [setPlayingState, stopPoll]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number) {
        const p = playerRef.current;
        if (!p) return false;
        try {
          const next = Math.max(0, seconds);
          p.seekTo(next, true);
          postYouTubeCommand(p, "seekTo", [next, true]);
          setCurrent(next);
          requestPlay();
          return true;
        } catch {
          return false;
        }
      },
    }),
    [requestPlay],
  );

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayerInstance | null = null;

    setReady(false);
    setError(null);
    setPlayingState(false);
    setStarted(false);
    // Always start muted so the first Play click works inside nested iframes.
    userMutedRef.current = true;
    setMuted(true);
    setCaptionsOn(false);
    setCurrent(0);
    setDuration(0);
    setControlsVisible(true);

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        hostRef.current.replaceChildren();
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        player = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            // Pre-mute the embed so the first playVideo() is allowed in nested iframes.
            mute: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            cc_load_policy: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerRef.current = e.target;
              hardenYouTubeIframe(e.target);
              muteYouTubePlayer(e.target);
              setReady(true);
              try {
                setDuration(e.target.getDuration() || 0);
                e.target.unloadModule?.("captions");
                setCaptionsOn(false);
              } catch {
                /* ignore */
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const isPlaying =
                e.data === YT_PLAYER_STATE.PLAYING || e.data === YT_PLAYER_STATE.BUFFERING;
              const isPaused =
                e.data === YT_PLAYER_STATE.PAUSED || e.data === YT_PLAYER_STATE.ENDED;

              if (isPlaying) {
                setStarted(true);
                setPlayingState(true);
                startPoll();
                // Only re-assert MUTE from state changes. Never unmute here —
                // programmatic unmute in nested iframes pauses playback.
                if (userMutedRef.current) {
                  muteYouTubePlayer(e.target);
                  setMuted(true);
                }
              } else if (isPaused) {
                setPlayingState(false);
                stopPoll();
                setControlsVisible(true);
                try {
                  setCurrent(e.target.getCurrentTime() || 0);
                } catch {
                  /* ignore */
                }
              }
            },
            onError: () => {
              if (!cancelled) setError("This video could not be loaded.");
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the video player.");
      });

    return () => {
      cancelled = true;
      stopPoll();
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId, setPlayingState, startPoll, stopPoll]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function togglePlay() {
    const p = playerRef.current;
    if (!p || !ready) return;
    revealControls();
    if (isYouTubePlayerActivelyPlaying(p) || playingRef.current) requestPause();
    else requestPlay();
  }

  /**
   * Mute/unmute must stay inside this click handler.
   * Unmute + playVideo in the same gesture — otherwise nested iframes pause.
   */
  function toggleMute() {
    const p = playerRef.current;
    if (!p || !ready) return;
    revealControls();

    if (userMutedRef.current) {
      userMutedRef.current = false;
      setMuted(false);
      unmuteYouTubePlayer(p);
      // Same user gesture: keep playback alive after enabling sound.
      playYouTubePlayer(p);
      setStarted(true);
      setPlayingState(true);
      startPoll();
    } else {
      userMutedRef.current = true;
      setMuted(true);
      muteYouTubePlayer(p);
    }
  }

  function setCaptionsEnabled(on: boolean) {
    const p = playerRef.current;
    if (!p) return false;
    try {
      if (on) {
        p.loadModule?.("captions");
        p.setOption?.("captions", "reload", true);
        p.setOption?.("captions", "fontSize", 1);
      } else {
        p.unloadModule?.("captions");
      }
      setCaptionsOn(on);
      return true;
    } catch {
      return false;
    }
  }

  function toggleCaptions() {
    revealControls();
    setCaptionsEnabled(!captionsOn);
  }

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    revealControls();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  }

  function onSeek(clientX: number, track: HTMLElement) {
    const p = playerRef.current;
    if (!p || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = ratio * duration;
    try {
      p.seekTo(next, true);
      postYouTubeCommand(p, "seekTo", [next, true]);
      setCurrent(next);
      if (!isYouTubePlayerActivelyPlaying(p) && !playingRef.current) requestPlay();
    } catch {
      /* ignore */
    }
    revealControls();
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const thumb = getYouTubeThumbnailUrl(videoId);
  const showUnmuteCue = started && muted && (playing || controlsVisible);

  return (
    <div
      ref={shellRef}
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden bg-zinc-950 select-none",
        className,
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playingRef.current) setControlsVisible(false);
      }}
    >
      <div
        ref={hostRef}
        className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
        aria-hidden
      />

      {/* One poster control — first click always mute+plays in embeds */}
      {!started && ready && !error ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-[3] bg-cover bg-center"
          style={{ backgroundImage: `url(${thumb})` }}
          aria-label={`Play ${title}`}
        >
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/35" />
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-105">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </span>
        </button>
      ) : null}

      {!ready && !error ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-zinc-950">
          <div className="h-9 w-9 animate-pulse rounded-full bg-primary/30" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 bg-zinc-950 px-4 text-center text-sm text-zinc-300">
          <p>{error}</p>
          <p className="text-xs text-zinc-500">Try opening the video on YouTube instead.</p>
        </div>
      ) : null}

      {/* Click video = show controls only (do not pause) */}
      {started && playing && !controlsVisible ? (
        <button
          type="button"
          className="absolute inset-0 z-[2] cursor-pointer bg-transparent"
          aria-label="Show controls"
          onClick={revealControls}
        />
      ) : null}

      {started && ready && !error && controlsVisible ? (
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "absolute left-1/2 top-1/2 z-[3] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition duration-200",
            "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          )}
        </button>
      ) : null}

      {/* Explicit unmute CTA — required for nested-iframe sound */}
      {showUnmuteCue ? (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute right-3 top-3 z-[5] inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/90"
        >
          <VolumeX className="h-3.5 w-3.5 text-primary" />
          Tap for sound
        </button>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[4] transition duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10">
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!ready}
            >
              {playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </button>

            <div
              className="group/seek relative h-5 flex-1 cursor-pointer"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(current)}
              tabIndex={0}
              onClick={(e) => onSeek(e.clientX, e.currentTarget)}
              onKeyDown={(e) => {
                const p = playerRef.current;
                if (!p || !duration) return;
                const step = e.shiftKey ? 10 : 5;
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = Math.min(duration, current + step);
                  p.seekTo(next, true);
                  postYouTubeCommand(p, "seekTo", [next, true]);
                  setCurrent(next);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = Math.max(0, current - step);
                  p.seekTo(next, true);
                  postYouTubeCommand(p, "seekTo", [next, true]);
                  setCurrent(next);
                }
              }}
            >
              <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                  style={{ width: `${progress}%` }}
                />
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-primary/30 transition group-hover/seek:scale-110"
                  style={{ left: `${progress}%` }}
                />
              </div>
            </div>

            <span className="shrink-0 tabular-nums text-[11px] font-medium text-white/90 sm:text-xs">
              {formatYouTubeTime(current)} / {formatYouTubeTime(duration)}
            </span>

            <button
              type="button"
              onClick={toggleMute}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={muted ? "Unmute" : "Mute"}
              disabled={!ready}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={toggleCaptions}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                captionsOn ? "text-primary" : "text-white/70 hover:text-white",
              )}
              aria-label={captionsOn ? "Hide subtitles" : "Show subtitles"}
              aria-pressed={captionsOn}
              disabled={!ready}
              title={captionsOn ? "Subtitles on" : "Subtitles off"}
            >
              <Captions className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
