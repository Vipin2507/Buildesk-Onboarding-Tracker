import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACADEMY_CATEGORY_ORDER } from "@/data/buildesk-academy-tutorials";
import { createAcademyTutorialId } from "@/lib/academy-catalog";
import { flushCrmMasterConfigPersistence } from "@/lib/config-persistence";
import { getYouTubeVideoId } from "@/lib/youtube";
import {
  getCrmMasterAcademyTutorials,
  useCrmMasterStore,
} from "@/stores/useCrmMasterStore";
import type { AcademyDifficulty, AcademyTutorial } from "@/types/buildesk-academy";

type Draft = {
  id: string;
  title: string;
  youtubeUrl: string;
  category: string;
  description: string;
  duration: string;
  tags: string;
  difficulty: AcademyDifficulty | "";
  featured: boolean;
  order: string;
  transcriptText: string;
};

function emptyDraft(order: number): Draft {
  return {
    id: "",
    title: "",
    youtubeUrl: "",
    category: "Getting Started",
    description: "",
    duration: "05:00",
    tags: "",
    difficulty: "beginner",
    featured: false,
    order: String(order),
    transcriptText: "",
  };
}

function tutorialToDraft(t: AcademyTutorial): Draft {
  return {
    id: t.id,
    title: t.title,
    youtubeUrl: t.youtubeUrl,
    category: t.category,
    description: t.description,
    duration: t.duration,
    tags: t.tags.join(", "),
    difficulty: t.difficulty ?? "",
    featured: Boolean(t.featured),
    order: String(t.order),
    transcriptText: (t.transcript ?? [])
      .map((s) =>
        [s.timestamp, s.title ?? "", s.text].join(" | "),
      )
      .join("\n"),
  };
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.trim().split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return Math.max(0, parts[0] ?? 0);
}

function draftToTutorial(draft: Draft, existing: AcademyTutorial[]): AcademyTutorial | null {
  const title = draft.title.trim();
  const youtubeUrl = draft.youtubeUrl.trim();
  if (!title) {
    toast.error("Title is required");
    return null;
  }
  if (!youtubeUrl || !getYouTubeVideoId(youtubeUrl)) {
    toast.error("Enter a valid YouTube URL");
    return null;
  }

  const transcript = draft.transcriptText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bits = line.split("|").map((b) => b.trim());
      const timestamp = bits[0] || "00:00";
      const titlePart = bits.length >= 3 ? bits[1] : "";
      const text = bits.length >= 3 ? bits.slice(2).join(" | ") : bits.slice(1).join(" | ");
      return {
        startSeconds: parseTimestampToSeconds(timestamp),
        timestamp,
        title: titlePart || undefined,
        text,
      };
    })
    .filter((s) => s.text);

  const id =
    draft.id.trim() ||
    createAcademyTutorialId(title, existing.filter((t) => t.id !== draft.id));

  return {
    id,
    title,
    youtubeUrl,
    category: draft.category.trim() || "CRM",
    description: draft.description.trim(),
    duration: draft.duration.trim() || "00:00",
    tags: draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    featured: draft.featured,
    order: Math.max(1, Number(draft.order) || existing.length + 1),
    difficulty: draft.difficulty || undefined,
    transcript: transcript.length ? transcript : undefined,
  };
}

export function CrmMasterAcademyPanel() {
  const academyTutorials = useCrmMasterStore((s) => s.academyTutorials);
  const setAcademyTutorials = useCrmMasterStore((s) => s.setAcademyTutorials);

  const tutorials = useMemo(() => getCrmMasterAcademyTutorials(), [academyTutorials]);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(1));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft(tutorials.length + 1));
    setModalOpen(true);
  }

  function openEdit(t: AcademyTutorial) {
    setEditingId(t.id);
    setDraft(tutorialToDraft(t));
    setModalOpen(true);
  }

  function saveDraft() {
    const nextTutorial = draftToTutorial(draft, tutorials);
    if (!nextTutorial) return;

    let next: AcademyTutorial[];
    if (editingId) {
      next = tutorials.map((t) => (t.id === editingId ? nextTutorial : t));
      if (nextTutorial.featured) {
        next = next.map((t) =>
          t.id === nextTutorial.id ? t : { ...t, featured: false },
        );
      }
    } else {
      if (tutorials.some((t) => t.id === nextTutorial.id)) {
        toast.error("A tutorial with this id already exists");
        return;
      }
      next = [...tutorials, nextTutorial];
      if (nextTutorial.featured) {
        next = next.map((t) =>
          t.id === nextTutorial.id ? t : { ...t, featured: false },
        );
      }
    }

    setAcademyTutorials(next);
    flushCrmMasterConfigPersistence();
    toast.success(editingId ? "Tutorial updated" : "Tutorial added");
    setModalOpen(false);
  }

  function confirmDelete() {
    if (!deleteId) return;
    setAcademyTutorials(tutorials.filter((t) => t.id !== deleteId));
    flushCrmMasterConfigPersistence();
    toast.success("Tutorial removed");
    setDeleteId(null);
  }

  return (
    <div className="space-y-3">
      <div className="card-soft space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Buildesk Academy</h3>
            <p className="text-[10px] text-muted-foreground">
              Tutorials shown in the client Support Portal. Edit title, YouTube URL, category,
              transcript, and more. Changes sync to portal visitors after save.
            </p>
          </div>
          <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add tutorial
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {tutorials.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-2 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{t.title}</span>
                  {t.featured ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                      Featured
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {t.category} · {t.duration} · {t.youtubeUrl}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                aria-label={`Edit ${t.title}`}
                onClick={() => openEdit(t)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${t.title}`}
                onClick={() => setDeleteId(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {tutorials.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground">
              No tutorials. Add one, or reset Master to restore defaults.
            </p>
          ) : null}
        </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "Edit academy tutorial" : "Add academy tutorial"}
        submitLabel={editingId ? "Save changes" : "Add tutorial"}
        onSubmit={saveDraft}
        contentClassName="max-w-lg"
      >
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label htmlFor="academy-title">Title</Label>
            <Input
              id="academy-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="academy-url">YouTube URL</Label>
            <Input
              id="academy-url"
              value={draft.youtubeUrl}
              onChange={(e) => setDraft((d) => ({ ...d, youtubeUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="academy-category">Category</Label>
              <input
                id="academy-category"
                list="academy-category-options"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              />
              <datalist id="academy-category-options">
                {ACADEMY_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="academy-duration">Duration</Label>
              <Input
                id="academy-duration"
                value={draft.duration}
                onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
                placeholder="08:42"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="academy-description">Description</Label>
            <Textarea
              id="academy-description"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              className="mt-1 resize-none text-xs"
            />
          </div>
          <div>
            <Label htmlFor="academy-tags">Tags (comma-separated)</Label>
            <Input
              id="academy-tags"
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="academy-difficulty">Difficulty</Label>
              <select
                id="academy-difficulty"
                value={draft.difficulty}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    difficulty: e.target.value as AcademyDifficulty | "",
                  }))
                }
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                <option value="">None</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <Label htmlFor="academy-order">Order</Label>
              <Input
                id="academy-order"
                type="number"
                min={1}
                value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: e.target.value }))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={draft.featured}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, featured: checked }))}
            />
            Featured on Academy landing
          </label>
          <div>
            <Label htmlFor="academy-transcript">Transcript</Label>
            <p className="mb-1 text-[10px] text-muted-foreground">
              One segment per line: <code>00:42 | Title | Body text</code>
            </p>
            <Textarea
              id="academy-transcript"
              value={draft.transcriptText}
              onChange={(e) => setDraft((d) => ({ ...d, transcriptText: e.target.value }))}
              rows={6}
              className="resize-y font-mono text-[11px]"
              placeholder={"00:00 | Introduction | Welcome…\n00:42 | Next step | …"}
            />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete tutorial?"
        description="This removes the tutorial from Buildesk Academy for all portal visitors."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
