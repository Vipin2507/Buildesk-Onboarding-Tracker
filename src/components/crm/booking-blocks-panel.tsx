import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BookingBlock } from "@/types/booking";

function formatBlockWhen(startsAt: string, endsAt: string) {
  const startDate = startsAt.slice(0, 10);
  const endDate = endsAt.slice(0, 10);
  const startTime = startsAt.slice(11, 16);
  const endTime = endsAt.slice(11, 16);
  if (startDate === endDate) return `${startDate} ${startTime}–${endTime}`;
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
  const upcoming = blocks.filter((b) => !blockIsPast(b.endsAt)).length;

  return (
    <div className={cn("card-soft overflow-hidden", className)}>
      <div className="flex flex-wrap items-end gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="text-xs font-semibold">Blocked time</div>
          <div className="text-[10px] text-muted-foreground">
            {upcoming} upcoming · hides portal slots
          </div>
        </div>
        <Input
          type="datetime-local"
          aria-label="Block starts"
          className="h-8 min-w-[10rem] flex-1 bg-background text-xs sm:max-w-[11rem]"
          value={blockStart}
          onChange={(e) => onBlockStartChange(e.target.value)}
        />
        <Input
          type="datetime-local"
          aria-label="Block ends"
          className="h-8 min-w-[10rem] flex-1 bg-background text-xs sm:max-w-[11rem]"
          value={blockEnd}
          onChange={(e) => onBlockEndChange(e.target.value)}
        />
        <Input
          aria-label="Block reason"
          placeholder="Reason"
          className="h-8 min-w-[8rem] flex-1 bg-background text-xs sm:max-w-[12rem]"
          value={blockReason}
          onChange={(e) => onBlockReasonChange(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2.5 text-xs"
          disabled={adding}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          {adding ? "…" : "Add"}
        </Button>
      </div>

      {blocks.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">No blocks yet.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {blocks.map((block) => {
            const past = blockIsPast(block.endsAt);
            return (
              <li
                key={block.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5",
                  past && "bg-muted/10 text-muted-foreground",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium tabular-nums">
                    {formatBlockWhen(block.startsAt, block.endsAt)}
                  </div>
                  {block.reason?.trim() ? (
                    <div className="truncate text-[10px] text-muted-foreground">{block.reason}</div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 p-0 hover:text-destructive"
                  aria-label="Remove block"
                  onClick={() => onRemove(block.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
