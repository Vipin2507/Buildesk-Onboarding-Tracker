import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building, ChevronLeft, ChevronRight } from "lucide-react";

import { APP_NAV, filterNavItems, isNavActive } from "@/lib/nav";
import { usePermissions } from "@/hooks/use-permissions";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "buildesk-sidebar-collapsed";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, can } = usePermissions();
  const navItems = filterNavItems(APP_NAV, { isAdmin, can });
  const chatBadge = useChatStore((s) => s.getLiveChatBadgeCount("erp"));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="relative hidden md:block shrink-0">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-[52px]" : "w-52",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center overflow-hidden",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          )}
        >
          <button
            type="button"
            onClick={collapsed ? toggle : undefined}
            title={collapsed ? "Expand sidebar" : undefined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground",
              collapsed && "cursor-pointer ring-2 ring-sidebar-primary/40 ring-offset-2 ring-offset-sidebar",
            )}
          >
            <Building className="h-4 w-4" />
          </button>
          {!collapsed ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-semibold tracking-tight text-white">Buildesk</div>
              <div className="truncate text-[10px] text-sidebar-foreground/70">Onboarding & Post-Sales</div>
            </div>
          ) : null}
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col overflow-x-hidden overflow-y-auto pb-3",
            collapsed ? "items-center px-1" : "px-1.5",
          )}
        >
          {navItems.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            const showAdminDivider = item.to === "/master";
            return (
              <div key={item.to}>
                {showAdminDivider && (
                  <div className="mx-2 mb-1.5 mt-3 border-t border-sidebar-border pt-2.5">
                    <div
                      className={cn(
                        "overflow-hidden text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 transition-[opacity,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        collapsed ? "h-0 opacity-0" : "h-4 opacity-100",
                      )}
                    >
                      Administration
                    </div>
                  </div>
                )}
                <Link
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium",
                    "transition-[color,padding,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    collapsed ? "h-9 w-9 justify-center p-0" : "px-2.5 py-1.5",
                    active
                      ? "text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-md bg-sidebar-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    />
                  )}
                  {active && !collapsed && (
                    <motion.span
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4 shrink-0" />
                  {!collapsed ? (
                    <span className="relative z-10 truncate">{item.label}</span>
                  ) : null}
                  {item.to === "/live-chat" && chatBadge > 0 ? (
                    <span
                      className={cn(
                        "relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground",
                        collapsed
                          ? "absolute -right-0.5 -top-0.5 h-4 min-w-4 px-0.5"
                          : "ml-auto px-1",
                      )}
                    >
                      {chatBadge > 9 ? "9+" : chatBadge}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>

        <div
          className={cn(
            "overflow-hidden border-t border-sidebar-border transition-[opacity,max-height,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed ? "max-h-0 opacity-0" : "max-h-16 px-3 py-3 opacity-100",
          )}
        >
          <div className="whitespace-nowrap text-[10px] text-sidebar-foreground/60">
            v1.0 · Buildesk Internal
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute top-[3.25rem] z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center",
          "rounded-full border border-border bg-card text-foreground shadow-md",
          "transition-[right,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "-right-4",
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );
}
