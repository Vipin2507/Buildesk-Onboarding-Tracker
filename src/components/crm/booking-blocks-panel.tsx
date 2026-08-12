import { CalendarOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BookingBlock } from "@/types/booking";

function formatBlockWhen(startsAt: string, endsAt: string) {
  const startDate = startsAt.slice(0, 10);
  const endDate = endsAt.slice(0, 10);
  const startTime = startsAt.slice(11, 16);
  const endTime = endsAt.slice(11, 16);
  if (startDate === endDate) {
    return `${startDate} · ${startTime} – ${endTime}`;
  }
  return `${startsAt.slice(0, 16).replace("T", " ")} → ${endsAt.slice(0, 16).replace("T", " ")}`;
}

function blockIsPast(endsAt: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const nowIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  return endsAt.slice(0, 19) < nowIso;
}

type BookingBlocksPanelProps = {
  blocks: BookingBlock[];
  blockStart: string;
  blockEnd: string;
  blockReason: string;
  onBlockStartChange: (value: string) => void;
  onBlockEndChange: (value: string) => void;
  onBlockReasonChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  adding?: boolean;
  className?: string;
};

export function BookingBlocksPanel({
  blocks,
  blockStart,
  blockEnd,
  blockReason,
  onBlockStartChange,
  onBlockEndChange,
  onBlockReasonChange,
  onAdd,
  onRemove,
  adding = false,
  className,
}: BookingBlocksPanelProps) {
  const upcoming = blocks.filter((b) => !blockIsPast(b.endsAt));
  const past = blocks.filter((b) => blockIsPast(b.endsAt));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <CalendarOff className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Blocked time</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Block vacation, focus time, or meetings. Blocked periods won&apos;t appear as bookable
                slots on the portal.
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {upcoming.length} upcoming · {past.length} past
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-border/70 bg-muted/20 px-4 py-3.5 sm:px-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Add block
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="block-start"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Starts
              </label>
              <Input
                id="block-start"
                type="datetime-local"
                className="h-9 bg-background text-sm"
                value={blockStart}
                onChange={(e) => onBlockStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="block-end" className="text-[11px] font-medium text-muted-foreground">
                Ends
              </label>
              <Input
                id="block-end"
                type="datetime-local"
                className="h-9 bg-background text-sm"
                value={blockEnd}
                onChange={(e) => onBlockEndChange(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <label htmlFor="block-reason" className="text-[11px] font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <Input
              id="block-reason"
              placeholder="Vacation, team offsite, focus block…"
              className="h-9 bg-background text-sm"
              value={blockReason}
              onChange={(e) => onBlockReasonChange(e.target.value)}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 px-4 text-xs"
              disabled={adding}
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              {adding ? "Adding…" : "Add block"}
            </Button>
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-5">
            <CalendarOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No blocked time</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a block above to hide slots during that period.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-border/50 bg-muted/10 px-4 py-2 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                When
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Action
              </span>
            </div>
            <ul className="divide-y divide-border/60">
              {blocks.map((block) => {
                const isPast = blockIsPast(block.endsAt);
                return (
                  <li
                    key={block.id}
                    className={cn(
                      "grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5",
                      isPast && "bg-muted/15",
                    )}
                  >
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          isPast && "text-muted-foreground",
                        )}
                      >
                        {formatBlockWhen(block.startsAt, block.endsAt)}
                      </div>
                      {isPast ? (
                        <span className="text-[10px] text-muted-foreground">Past</span>
                      ) : (
                        <span className="text-[10px] font-medium text-warning-foreground">
                          Upcoming
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 text-xs text-muted-foreground sm:text-sm">
                      {block.reason?.trim() || "—"}
                    </div>
                    <div className="flex justify-end sm:justify-start">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove block"
                        onClick={() => onRemove(block.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
