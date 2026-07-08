import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    size?: "sm" | "md" | "lg";
  }
>(({ className, size = "md", ...props }, ref) => {
  const sizes = {
    sm: {
      root: "h-5 w-9",
      thumb: "h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5",
    },
    md: {
      root: "h-6 w-11",
      thumb: "h-[18px] w-[18px] data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
    },
    lg: {
      root: "h-7 w-12",
      thumb: "h-5 w-5 data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0.5",
    },
  } as const;

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent",
        "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_0_0_3px_rgb(0_155_255_/_0.12)]",
        "data-[state=unchecked]:bg-slate-200 data-[state=unchecked]:hover:bg-slate-300",
        sizes[size].root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgb(15_23_42_/_0.18),0_1px_1px_rgb(15_23_42_/_0.08)]",
          "ring-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-[state=checked]:scale-100 data-[state=unchecked]:scale-[0.96]",
          sizes[size].thumb,
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
