import { normalizeAcademyTutorials, seedAcademyTutorials } from "@/lib/academy-catalog";
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from "@/lib/youtube";
import type {
  AcademyProgressMap,
  AcademyTutorial,
  AcademyTutorialProgress,
} from "@/types/buildesk-academy";

export function listAcademyTutorials(source?: AcademyTutorial[] | null): AcademyTutorial[] {
  return normalizeAcademyTutorials(source ?? seedAcademyTutorials());
}

export function getAcademyTutorial(
  id: string,
  source?: AcademyTutorial[] | null,
): AcademyTutorial | undefined {
  return listAcademyTutorials(source).find((t) => t.id === id);
}

export function listAcademyCategories(tutorials: AcademyTutorial[]): string[] {
  const set = new Set<string>();
  for (const t of tutorials) set.add(t.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function getAcademyFeatured(tutorials: AcademyTutorial[]): AcademyTutorial | undefined {
  return tutorials.find((t) => t.featured) ?? tutorials[0];
}

export function resolveTutorialThumbnail(tutorial: AcademyTutorial): string {
  if (tutorial.thumbnailUrl) return tutorial.thumbnailUrl;
  const id = getYouTubeVideoId(tutorial.youtubeUrl);
  return id ? getYouTubeThumbnailUrl(id) : "";
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase();
}

function tutorialSearchBlob(tutorial: AcademyTutorial): string {
  const transcript = (tutorial.transcript ?? [])
    .map((s) => `${s.title ?? ""} ${s.text}`)
    .join(" ");
  return [
    tutorial.title,
    tutorial.description,
    tutorial.category,
    tutorial.tags.join(" "),
    transcript,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterAcademyTutorials(
  tutorials: AcademyTutorial[],
  opts: { query?: string; category?: string | "all" },
): AcademyTutorial[] {
  const q = normalizeQuery(opts.query ?? "");
  const category = opts.category && opts.category !== "all" ? opts.category : null;

  return tutorials.filter((t) => {
    if (category && t.category !== category) return false;
    if (!q) return true;
    return tutorialSearchBlob(t).includes(q);
  });
}

export function getRelatedTutorials(
  tutorial: AcademyTutorial,
  all: AcademyTutorial[],
  limit = 3,
): AcademyTutorial[] {
  const tagSet = new Set(tutorial.tags.map((t) => t.toLowerCase()));
  const titleWords = new Set(
    tutorial.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );

  const scored = all
    .filter((t) => t.id !== tutorial.id)
    .map((t) => {
      let score = 0;
      if (t.category === tutorial.category) score += 5;
      for (const tag of t.tags) {
        if (tagSet.has(tag.toLowerCase())) score += 2;
      }
      for (const w of t.title.toLowerCase().split(/\W+/)) {
        if (titleWords.has(w)) score += 1;
      }
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.order - b.t.order);

  const related = scored.slice(0, limit).map((x) => x.t);
  if (related.length >= limit) return related;

  const fillers = all
    .filter((t) => t.id !== tutorial.id && !related.some((r) => r.id === t.id))
    .slice(0, limit - related.length);
  return [...related, ...fillers];
}

export function getAdjacentTutorials(
  tutorial: AcademyTutorial,
  all: AcademyTutorial[],
): { previous?: AcademyTutorial; next?: AcademyTutorial } {
  const sorted = [...all].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((t) => t.id === tutorial.id);
  if (idx < 0) return {};
  return {
    previous: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}

function progressStorageKey(portalSlug: string) {
  return `buildesk-academy-progress:${portalSlug}`;
}

export function loadAcademyProgress(portalSlug: string): AcademyProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(progressStorageKey(portalSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AcademyProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAcademyProgress(portalSlug: string, map: AcademyProgressMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progressStorageKey(portalSlug), JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function getTutorialProgress(
  map: AcademyProgressMap,
  tutorialId: string,
): AcademyTutorialProgress {
  return (
    map[tutorialId] ?? {
      status: "not_started",
      percent: 0,
      updatedAt: new Date(0).toISOString(),
    }
  );
}

export function markTutorialInProgress(
  portalSlug: string,
  tutorialId: string,
  percent = 15,
): AcademyProgressMap {
  const map = loadAcademyProgress(portalSlug);
  const existing = getTutorialProgress(map, tutorialId);
  if (existing.status === "completed") return map;
  const next: AcademyTutorialProgress = {
    status: "in_progress",
    percent: Math.max(existing.percent, Math.min(99, percent)),
    updatedAt: new Date().toISOString(),
  };
  const updated = { ...map, [tutorialId]: next };
  saveAcademyProgress(portalSlug, updated);
  return updated;
}

export function markTutorialComplete(
  portalSlug: string,
  tutorialId: string,
): AcademyProgressMap {
  const map = loadAcademyProgress(portalSlug);
  const now = new Date().toISOString();
  const updated: AcademyProgressMap = {
    ...map,
    [tutorialId]: {
      status: "completed",
      percent: 100,
      completedAt: now,
      updatedAt: now,
    },
  };
  saveAcademyProgress(portalSlug, updated);
  return updated;
}
