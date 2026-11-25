import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One scrolling row of stat chips below the md breakpoint. Wider layouts keep their grid. */
export const phoneStatTrack =
  "max-md:!flex max-md:snap-x max-md:snap-mandatory max-md:gap-2 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden";

export const phoneStatChip =
  "max-md:!w-[7.75rem] max-md:!min-w-[7.75rem] max-md:!max-w-[7.75rem] max-md:!flex-none max-md:shrink-0 max-md:snap-start max-md:min-h-14";

/**
 * Laptop: secondary actions, then the primary action, in one row.
 * Phone: the primary action stays visible. Extra actions sit behind one control.
 */
export function PhoneToolbar({
  primary,
  moreLabel = "More actions",
  children,
  className,
}: {
  primary?: ReactNode;
  moreLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasPrimary = primary != null && primary !== false;
  const hasMore = children != null && children !== false;

  return (
    <div className={className}>
      <div className="hidden flex-wrap items-center gap-1.5 md:flex">
        {children}
        {primary}
      </div>
      <div className="flex w-full flex-col gap-2 md:hidden">
        {hasPrimary ? (
          <div className="[&_a]:inline-flex [&_a]:min-h-12 [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_button]:min-h-12 [&_button]:w-full [&_button]:text-sm">
            {primary}
          </div>
        ) : null}
        {hasMore && hasPrimary ? (
          <>
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Hide actions" : moreLabel}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
            {open ? (
              <div className="flex flex-col gap-2 [&_a]:inline-flex [&_a]:min-h-12 [&_a]:w-full [&_a]:items-center [&_a]:justify-start [&_button]:min-h-12 [&_button]:w-full [&_button]:justify-start [&_button]:text-sm">
                {children}
              </div>
            ) : null}
          </>
        ) : null}
        {hasMore && !hasPrimary ? (
          <div className="flex flex-col gap-2 [&_a]:inline-flex [&_a]:min-h-12 [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_button]:min-h-12 [&_button]:w-full [&_button]:text-sm">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
