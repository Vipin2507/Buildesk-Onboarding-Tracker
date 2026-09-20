/** Buildesk Academy — portal tutorial catalog types. */

export type AcademyDifficulty = "beginner" | "intermediate" | "advanced";

export type AcademyTranscriptSegment = {
  /** Start time in seconds (for seek). */
  startSeconds: number;
  /** Display label e.g. "00:42". */
  timestamp: string;
  title?: string;
  text: string;
};

export type AcademyTutorial = {
  id: string;
  title: string;
  description: string;
  category: string;
  /** Full YouTube watch / share / embed URL. */
  youtubeUrl: string;
  duration: string;
  /** Human-readable duration minutes for display helpers. */
  durationMinutes?: number;
  tags: string[];
  featured?: boolean;
  order: number;
  difficulty?: AcademyDifficulty;
  transcript?: AcademyTranscriptSegment[];
  /** Optional override; defaults to YouTube hqdefault thumbnail. */
  thumbnailUrl?: string;
};

export type AcademyProgressStatus = "not_started" | "in_progress" | "completed";

export type AcademyTutorialProgress = {
  status: AcademyProgressStatus;
  /** 0–100 */
  percent: number;
  completedAt?: string;
  updatedAt: string;
};

export type AcademyProgressMap = Record<string, AcademyTutorialProgress>;
