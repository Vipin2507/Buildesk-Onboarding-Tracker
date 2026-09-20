import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  PlusCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { AcademyTutorialCard } from "@/components/portal/academy/academy-tutorial-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listPortalAcademyTutorials } from "@/lib/api";
import {
  getAdjacentTutorials,
  getRelatedTutorials,
  getTutorialProgress,
  listAcademyTutorials,
  loadAcademyProgress,
  markTutorialComplete,
  markTutorialInProgress,
} from "@/lib/buildesk-academy";
import { getYouTubeEmbedUrl, getYouTubeVideoId, seekYouTubeIframe } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import type { AcademyProgressMap, AcademyTutorial } from "@/types/buildesk-academy";

export function AcademyTutorialViewerPage({
  slug,
  tutorialId,
}: {
  slug: string;
  tutorialId: string;
}) {
  const [all, setAll] = useState<AcademyTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void listPortalAcademyTutorials()
      .then((rows) => {
        if (!cancelled) setAll(listAcademyTutorials(rows));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load tutorial");
          setAll([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tutorial = useMemo(
    () => all.find((t) => t.id === tutorialId),
    [all, tutorialId],
  );

  const [progressMap, setProgressMap] = useState<AcademyProgressMap>(() =>
    loadAcademyProgress(slug),
  );
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [panel, setPanel] = useState<"transcript" | "related">("transcript");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!tutorial) return;
    setProgressMap(markTutorialInProgress(slug, tutorial.id));
  }, [slug, tutorial]);

  if (loading) {
    return <AcademyTutorialViewerSkeleton />;
  }

  if (loadError || !tutorial) {
    return (
      <PortalPageWrap>
        <div className="rounded-xl border border-dashed px-4 py-12 text-center">
          <p className="text-sm font-medium">Unable to load this tutorial.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {loadError ??
              "It may have been removed. Return to the academy library or contact support."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" className="h-8">
              <Link to="/portal/$slug/academy" params={{ slug }}>
                Back to Buildesk Academy
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link to="/portal/$slug/create-ticket" params={{ slug }}>
                Raise a ticket
              </Link>
            </Button>
          </div>
        </div>
      </PortalPageWrap>
    );
  }

  const videoId = getYouTubeVideoId(tutorial.youtubeUrl);
  const progress = getTutorialProgress(progressMap, tutorial.id);
  const related = getRelatedTutorials(tutorial, all, 3);
  const { previous, next } = getAdjacentTutorials(tutorial, all);

  const segments = tutorial.transcript ?? [];
  const filteredSegments = transcriptQuery.trim()
    ? segments.filter((s) => {
        const q = transcriptQuery.toLowerCase();
        return (
          s.text.toLowerCase().includes(q) ||
          (s.title?.toLowerCase().includes(q) ?? false) ||
          s.timestamp.includes(q)
        );
      })
    : segments;

  function handleComplete() {
    const nextMap = markTutorialComplete(slug, tutorial!.id);
    setProgressMap(nextMap);
    toast.success("Tutorial marked complete");
  }

  function handleSeek(seconds: number) {
    const ok = seekYouTubeIframe(iframeRef.current, seconds);
    if (!ok) {
      toast.message("Open the video and try again to jump to this timestamp");
    }
  }

  return (
    <PortalPageWrap>
      <motion.div
        variants={ticketPageVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        <motion.div variants={ticketSectionVariants} className="space-y-2">
          <Link
            to="/portal/$slug/academy"
            params={{ slug }}
            className="portal-content-link inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Buildesk Academy
          </Link>
          <DesignTicketPageHeader title={tutorial.title} />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-primary">{tutorial.category}</span>
            <span className="mx-1.5 text-border">·</span>
            <span className="tabular-nums">{tutorial.duration}</span>
          </p>
        </motion.div>

        <motion.div
          variants={ticketSectionVariants}
          className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]"
        >
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-zinc-950 shadow-sm ring-1 ring-amber-500/10">
              <div className="relative aspect-video w-full bg-black">
                {videoId ? (
                  <iframe
                    ref={iframeRef}
                    key={videoId}
                    title={tutorial.title}
                    src={getYouTubeEmbedUrl(videoId)}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-300">
                    <p>Unable to load this video.</p>
                    <p className="text-xs text-zinc-500">Invalid or missing YouTube URL.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 bg-zinc-900/90 px-3 py-2">
                <Button
                  type="button"
                  size="sm"
                  variant={panel === "transcript" ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-[11px] text-zinc-100 hover:bg-white/10 hover:text-white"
                  onClick={() => setPanel("transcript")}
                >
                  Transcript
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={panel === "related" ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-[11px] text-zinc-100 hover:bg-white/10 hover:text-white"
                  onClick={() => setPanel("related")}
                >
                  Related
                </Button>
                <span className="ml-auto text-[10px] tabular-nums text-zinc-400">
                  {tutorial.duration}
                </span>
                {videoId ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white"
                  >
                    YouTube
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tutorial.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tutorial.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-xs transition duration-200",
                    progress.status === "completed" &&
                      "bg-success text-success-foreground hover:bg-success/90",
                  )}
                  onClick={handleComplete}
                  disabled={progress.status === "completed"}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {progress.status === "completed" ? "Completed" : "Mark as complete"}
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link to="/portal/$slug/book" params={{ slug }}>
                    <Calendar className="h-3.5 w-3.5" />
                    Book a call
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link to="/portal/$slug/create-ticket" params={{ slug }}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    Raise a ticket
                  </Link>
                </Button>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Ask an executive via live chat
                </span>
              </div>
            </div>
          </div>

          <aside className="min-h-[280px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:min-h-[420px]">
            {panel === "transcript" ? (
              <TranscriptPanel
                tutorial={tutorial}
                query={transcriptQuery}
                onQueryChange={setTranscriptQuery}
                segments={filteredSegments}
                hasTranscript={segments.length > 0}
                onSeek={handleSeek}
              />
            ) : (
              <div className="flex h-full flex-col p-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Related tutorials
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {related.map((t) => (
                    <AcademyTutorialCard
                      key={t.id}
                      tutorial={t}
                      slug={slug}
                      progressMap={progressMap}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </motion.div>

        <motion.div
          variants={ticketSectionVariants}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"
        >
          {previous ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link
                to="/portal/$slug/academy/$tutorialId"
                params={{ slug, tutorialId: previous.id }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <Link
                to="/portal/$slug/academy/$tutorialId"
                params={{ slug, tutorialId: next.id }}
              >
                Next tutorial
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </motion.div>

        <motion.section variants={ticketSectionVariants} className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Up next</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
              <AcademyTutorialCard
                key={`upnext-${t.id}`}
                tutorial={t}
                slug={slug}
                progressMap={progressMap}
              />
            ))}
          </div>
        </motion.section>
      </motion.div>
    </PortalPageWrap>
  );
}

function TranscriptPanel({
  tutorial,
  query,
  onQueryChange,
  segments,
  hasTranscript,
  onSeek,
}: {
  tutorial: AcademyTutorial;
  query: string;
  onQueryChange: (v: string) => void;
  segments: NonNullable<AcademyTutorial["transcript"]>;
  hasTranscript: boolean;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="flex h-full max-h-[70vh] flex-col lg:max-h-none">
      <div className="border-b border-border/70 px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transcript
        </h2>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search transcript…"
            aria-label="Search transcript"
            className="h-8 rounded-lg pl-8 text-xs"
            disabled={!hasTranscript}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!hasTranscript ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Transcript unavailable for this tutorial.
          </p>
        ) : segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transcript matches for “{query}”.</p>
        ) : (
          <ol className="space-y-3">
            {segments.map((seg) => (
              <li key={`${tutorial.id}-${seg.startSeconds}-${seg.timestamp}`}>
                <button
                  type="button"
                  onClick={() => onSeek(seg.startSeconds)}
                  className="group w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary group-hover:bg-primary/15">
                      {seg.timestamp}
                    </span>
                    {seg.title ? (
                      <span className="text-[11px] font-medium text-foreground">{seg.title}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{seg.text}</p>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function AcademyTutorialViewerSkeleton() {
  return (
    <PortalPageWrap>
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-2/3" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="min-h-[280px] rounded-xl" />
        </div>
      </div>
    </PortalPageWrap>
  );
}
