import { Play } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTutorialProgress,
  resolveTutorialThumbnail,
} from "@/lib/buildesk-academy";
import { cn } from "@/lib/utils";
import type { AcademyProgressMap, AcademyTutorial } from "@/types/buildesk-academy";

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function AcademyTutorialCard({
  tutorial,
  slug,
  progressMap,
  compact,
}: {
  tutorial: AcademyTutorial;
  slug: string;
  progressMap: AcademyProgressMap;
  compact?: boolean;
}) {
  const progress = getTutorialProgress(progressMap, tutorial.id);
  const thumb = resolveTutorialThumbnail(tutorial);

  return (
    <Link
      to="/portal/$slug/academy/$tutorialId"
      params={{ slug, tutorialId: tutorial.id }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-left shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        "motion-reduce:transform-none motion-reduce:transition-none",
      )}
    >
      <div className={cn("relative overflow-hidden bg-muted", compact ? "aspect-video" : "aspect-[16/10]")}>
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
            <Play className="h-8 w-8 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-primary shadow-md transition duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
            <Play className="h-5 w-5 fill-current" aria-hidden />
          </span>
        </div>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          {tutorial.duration}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {tutorial.category}
          </span>
          {tutorial.difficulty ? (
            <span className="text-[10px] text-muted-foreground">
              {DIFFICULTY_LABEL[tutorial.difficulty] ?? tutorial.difficulty}
            </span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {tutorial.title}
        </h3>
        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
          {tutorial.description}
        </p>

        {progress.status !== "not_started" ? (
          <div className="mt-1">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {progress.status === "completed" ? "Completed" : "In progress"}
              </span>
              <span className="tabular-nums">{progress.percent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progress.status === "completed" ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-full text-[11px] pointer-events-none"
            tabIndex={-1}
          >
            Watch tutorial
          </Button>
        </div>
      </div>
    </Link>
  );
}

export function AcademyTutorialCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[60%]" />
        <Skeleton className="mt-2 h-7 w-full" />
      </div>
    </div>
  );
}
