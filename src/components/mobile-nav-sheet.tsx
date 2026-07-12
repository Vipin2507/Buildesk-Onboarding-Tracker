import { Link, useRouterState } from "@tanstack/react-router";
import { Building } from "lucide-react";
import { motion } from "framer-motion";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_NAV, isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function MobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[min(100%,20rem)] flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground md:hidden [&>button]:text-sidebar-foreground [&>button]:hover:text-white"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Building className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold tracking-tight text-white">
                Buildesk
              </SheetTitle>
              <p className="text-[11px] text-sidebar-foreground/70">Onboarding & Post-Sales</p>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {APP_NAV.map((item, i) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            const showAdminDivider = item.to === "/master";
            return (
              <div key={item.to}>
                {showAdminDivider && (
                  <div className="mx-2 mb-2 mt-4 border-t border-sidebar-border pt-3">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                      Administration
                    </div>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, delay: Math.min(i * 0.02, 0.24), ease }}
                >
                  <Link
                    to={item.to}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-white"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-white",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </motion.div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-[10px] text-sidebar-foreground/60">
          v1.0 · Buildesk Internal
        </div>
      </SheetContent>
    </Sheet>
  );
}
