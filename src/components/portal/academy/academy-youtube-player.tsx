import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
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
  loadYouTubeIframeApi,
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

export const AcademyYouTubePlayer = forwardRef<
  AcademyYouTubePlayerHandle,
  AcademyYouTubePlayerProps
>(function AcademyYouTubePlayer({ videoId, title, className, onPlayingChange }, ref) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const pollRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

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
        /* player mid-destroy */
      }
    }, 250);
  }, [stopPoll]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playerRef.current?.getPlayerState() === YT_PLAYER_STATE.PLAYING) {
        setControlsVisible(false);
      }
    }, 2800);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number) {
        const p = playerRef.current;
        if (!p) return false;
        try {
          p.seekTo(Math.max(0, seconds), true);
          p.playVideo();
          setPlaying(true);
          onPlayingChange?.(true);
          revealControls();
          return true;
        } catch {
          return false;
        }
      },
    }),
    [onPlayingChange, revealControls],
  );

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayerInstance | null = null;

    setReady(false);
    setError(null);
    setPlaying(false);
    setStarted(false);
    setCurrent(0);
    setDuration(0);
    setControlsVisible(true);

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        // Clear previous iframe host contents before creating a new player
        hostRef.current.replaceChildren();
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        player = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
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
              setReady(true);
              try {
                setDuration(e.target.getDuration() || 0);
                setMuted(e.target.isMuted());
              } catch {
                /* ignore */
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const isPlaying = e.data === YT_PLAYER_STATE.PLAYING;
              const isPaused =
                e.data === YT_PLAYER_STATE.PAUSED || e.data === YT_PLAYER_STATE.ENDED;
              if (isPlaying) {
                setPlaying(true);
                setStarted(true);
                onPlayingChange?.(true);
                startPoll();
                revealControls();
              } else if (isPaused) {
                setPlaying(false);
                onPlayingChange?.(false);
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
  }, [videoId, onPlayingChange, revealControls, startPoll, stopPoll]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    revealControls();
    try {
      if (playing) p.pauseVideo();
      else p.playVideo();
    } catch {
      /* ignore */
    }
  }

  function toggleMute() {
    const p = playerRef.current;
    if (!p) return;
    revealControls();
    try {
      if (p.isMuted()) {
        p.unMute();
        setMuted(false);
      } else {
        p.mute();
        setMuted(true);
      }
    } catch {
      /* ignore */
    }
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
      setCurrent(next);
      if (!playing) p.playVideo();
    } catch {
      /* ignore */
    }
    revealControls();
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const thumb = getYouTubeThumbnailUrl(videoId);

  return (
    <div
      ref={shellRef}
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden bg-zinc-950 select-none",
        className,
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
    >
      {/* Chromeless YouTube host — pointer events off so YT chrome never captures hover */}
      <div
        ref={hostRef}
        className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
        aria-hidden
      />

      {/* Poster until first play (keeps YT chrome covered before interaction) */}
      {!started && ready ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-[1] bg-cover bg-center"
          style={{ backgroundImage: `url(${thumb})` }}
          aria-label={`Play ${title}`}
        >
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
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

      {/* Center play affordance */}
      {ready && !error && (!playing || controlsVisible) ? (
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "absolute left-1/2 top-1/2 z-[3] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition duration-200",
            "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            playing && "opacity-90",
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

      {/* Click-catcher while playing (pause) when controls hidden */}
      {playing && !controlsVisible ? (
        <button
          type="button"
          className="absolute inset-0 z-[2] cursor-pointer bg-transparent"
          aria-label="Show controls"
          onClick={() => {
            revealControls();
            togglePlay();
          }}
        />
      ) : null}

      {/* Custom control bar — portal primary accents */}
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
                  p.seekTo(Math.min(duration, current + step), true);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  p.seekTo(Math.max(0, current - step), true);
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
