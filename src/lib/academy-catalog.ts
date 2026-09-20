import type { AcademyTutorial } from "@/types/buildesk-academy";
import { ACADEMY_TUTORIALS } from "@/data/buildesk-academy-tutorials";
import { getYouTubeVideoId } from "@/lib/youtube";

export function seedAcademyTutorials(): AcademyTutorial[] {
  return ACADEMY_TUTORIALS.map((t) => ({
    ...t,
    tags: [...t.tags],
    transcript: t.transcript?.map((s) => ({ ...s })),
  }));
}

function slugifyTutorialId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function normalizeTranscript(
  raw: AcademyTutorial["transcript"] | undefined,
): AcademyTutorial["transcript"] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const segments = raw
    .map((s) => ({
      startSeconds: Math.max(0, Number(s.startSeconds) || 0),
      timestamp: String(s.timestamp ?? "").trim() || "00:00",
      title: String(s.title ?? "").trim() || undefined,
      text: String(s.text ?? "").trim(),
    }))
    .filter((s) => s.text);
  return segments.length ? segments : undefined;
}

/** Normalize master/portal academy catalog; missing → seed defaults. */
export function normalizeAcademyTutorials(
  existing: AcademyTutorial[] | undefined | null,
): AcademyTutorial[] {
  if (!Array.isArray(existing)) return seedAcademyTutorials();

  const seen = new Set<string>();
  const out: AcademyTutorial[] = [];

  for (const [i, row] of existing.entries()) {
    const title = String(row.title ?? "").trim();
    const youtubeUrl = String(row.youtubeUrl ?? "").trim();
    if (!title || !youtubeUrl) continue;

    let id = String(row.id ?? "").trim() || slugifyTutorialId(title);
    id = slugifyTutorialId(id) || `tutorial-${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);

    const videoId = getYouTubeVideoId(youtubeUrl);
    out.push({
      id,
      title,
      description: String(row.description ?? "").trim(),
      category: String(row.category ?? "").trim() || "CRM",
      youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : youtubeUrl,
      duration: String(row.duration ?? "").trim() || "00:00",
      durationMinutes:
        typeof row.durationMinutes === "number" && Number.isFinite(row.durationMinutes)
          ? Math.max(1, Math.round(row.durationMinutes))
          : undefined,
      tags: Array.isArray(row.tags)
        ? row.tags.map((t) => String(t).trim()).filter(Boolean)
        : [],
      featured: Boolean(row.featured),
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : i + 1,
      difficulty:
        row.difficulty === "beginner" ||
        row.difficulty === "intermediate" ||
        row.difficulty === "advanced"
          ? row.difficulty
          : undefined,
      transcript: normalizeTranscript(row.transcript),
      thumbnailUrl: row.thumbnailUrl?.trim() || undefined,
    });
  }

  return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * Fill empty transcripts from the seed catalog (by tutorial id) without
 * overwriting admin-edited transcript text.
 */
export function mergeAcademySeedTranscripts(tutorials: AcademyTutorial[]): {
  tutorials: AcademyTutorial[];
  changed: boolean;
} {
  const seedById = new Map(seedAcademyTutorials().map((t) => [t.id, t]));
  let changed = false;
  const next = tutorials.map((t) => {
    if (t.transcript && t.transcript.length > 0) return t;
    const seed = seedById.get(t.id);
    if (!seed?.transcript?.length) return t;
    changed = true;
    return {
      ...t,
      transcript: seed.transcript.map((s) => ({ ...s })),
    };
  });
  return { tutorials: next, changed };
}

export function createAcademyTutorialId(title: string, existing: AcademyTutorial[]): string {
  const base = slugifyTutorialId(title) || "tutorial";
  if (!existing.some((t) => t.id === base)) return base;
  let n = 2;
  while (existing.some((t) => t.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
