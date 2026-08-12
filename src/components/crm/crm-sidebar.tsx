import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Contact, ChevronLeft, ChevronRight } from "lucide-react";

import { CRM_NAV } from "@/lib/crm-nav";
import { isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores";
import { useChatStore } from "@/stores/useChatStore";

const STORAGE_KEY = "buildesk-crm-sidebar-collapsed";

export function CrmSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "Admin";
  const chatBadge = useChatStore((s) => s.getLiveChatBadgeCount("crm"));
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

  const navItems = CRM_NAV.filter((item) => !item.adminOnly || isAdmin);

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
            <Contact className="h-4 w-4" />
          </button>
          {!collapsed ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-semibold tracking-tight text-white">Buildesk CRM</div>
              <div className="truncate text-[10px] text-sidebar-foreground/70">Onboarding & Go-Live</div>
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
            return (
              <Link
                key={item.to}
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
                {active ? (
                  <motion.span
                    layoutId="crm-sidebar-active"
                    className="absolute inset-0 rounded-md bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                {!collapsed ? (
                  <span className="relative z-10 truncate">{item.label}</span>
                ) : null}
                {item.to === "/crm/live-chat" && chatBadge > 0 ? (
                  <span
                    className={cn(
                      "relative z-10 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground",
                      collapsed
                        ? "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center px-0.5"
                        : "ml-auto px-1.5",
                    )}
                  >
                    {chatBadge > 9 ? "9+" : chatBadge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex h-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white",
            collapsed ? "mx-auto mb-1.5 w-9" : "m-1.5 w-[calc(100%-0.75rem)]",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>
    </div>
  );
}
