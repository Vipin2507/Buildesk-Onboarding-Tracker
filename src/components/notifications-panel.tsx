import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isTaskReminderNotification } from "@/lib/task-reminder-window";
import { isCrmUser } from "@/lib/product-scope";
import { cn } from "@/lib/utils";
import { useCurrentUser, useNotificationStore } from "@/stores";
import type { AppNotification } from "@/types";
import { formatRelativeTime } from "@/types/common";

const kindDot: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

const AUTO_OPEN_DELAY_MS = 220;
const HIGHLIGHT_MS = 4200;

function isCrmScopedNotification(n: AppNotification) {
  return Boolean(n.href?.startsWith("/crm"));
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const allNotifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const crm = isCrmUser(currentUser);

  const notifications = useMemo(() => {
    return crm
      ? allNotifications.filter(isCrmScopedNotification)
      : allNotifications.filter((notification) => !isCrmScopedNotification(notification));
  }, [allNotifications, crm]);
  const unread = notifications.filter((n) => !n.readAt).length;
  const inAppEnabled = currentUser?.notifyInApp !== false;
  const [open, setOpen] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [bellAttention, setBellAttention] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const seenTaskReminderIdsRef = useRef<Set<string> | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!inAppEnabled) return;

    const unreadTaskReminders = notifications.filter(
      (n) => !n.readAt && isTaskReminderNotification(n),
    );

    if (seenTaskReminderIdsRef.current === null) {
      seenTaskReminderIdsRef.current = new Set(unreadTaskReminders.map((n) => n.id));
      return;
    }

    const fresh = unreadTaskReminders.filter((n) => !seenTaskReminderIdsRef.current!.has(n.id));
    if (fresh.length === 0) return;

    for (const n of fresh) {
      seenTaskReminderIdsRef.current!.add(n.id);
    }

    setBellAttention(true);
    setHighlightIds(fresh.map((n) => n.id));

    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      setAutoReveal(true);
      setOpen(true);
    }, AUTO_OPEN_DELAY_MS);

    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightIds([]);
    }, HIGHLIGHT_MS);
  }, [notifications, inAppEnabled]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setAutoReveal(false);
      setBellAttention(false);
      setHighlightIds([]);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground transition-colors hover:text-foreground"
          title="Notifications"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
          animate={
            bellAttention
              ? {
                  rotate: [0, -14, 14, -9, 9, -4, 0],
                  scale: [1, 1.06, 1.04, 1],
                }
              : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.55, ease: TICKET_EASE }}
          onAnimationComplete={() => {
            if (bellAttention) setBellAttention(false);
          }}
        >
          <Bell className="h-4 w-4" />
          {inAppEnabled && unread > 0 ? (
            <motion.span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
              animate={bellAttention ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: TICKET_EASE }}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          ) : null}
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] overflow-hidden border-border bg-popover p-0 text-popover-foreground shadow-lg",
          "data-[state=open]:animate-none data-[state=closed]:animate-none",
        )}
      >
        <motion.div
          initial={
            autoReveal
              ? { opacity: 0, y: -18, scale: 0.94, transformOrigin: "top right" }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: autoReveal ? 0.48 : 0.22,
            ease: TICKET_EASE,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5">
            <div className="text-sm font-semibold">Notifications</div>
            {inAppEnabled && unread > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  for (const notification of notifications) {
                    if (!notification.readAt) markRead(notification.id);
                  }
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            ) : null}
          </div>

          {!inAppEnabled ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              In-app notifications are turned off in your profile.
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              You’re all caught up.
            </div>
          ) : (
            <ScrollArea className="h-[min(60vh,22rem)]">
              <ul className="divide-y divide-border/70">
                {notifications.map((n, index) => (
                  <motion.li
                    key={n.id}
                    initial={
                      autoReveal && highlightIds.includes(n.id)
                        ? { opacity: 0, x: 10 }
                        : false
                    }
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.38,
                      ease: TICKET_EASE,
                      delay: autoReveal && highlightIds.includes(n.id) ? 0.12 + index * 0.04 : 0,
                    }}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                        !n.readAt && "bg-primary/5",
                        highlightIds.includes(n.id) && "bg-amber-500/10 ring-1 ring-inset ring-amber-500/25",
                      )}
                      onClick={() => {
                        markRead(n.id);
                        if (n.href) {
                          void router.navigate({ to: n.href });
                          return;
                        }
                        if (n.ticketId) {
                          if (n.ticketId.startsWith("TKT-")) {
                            void navigate({
                              to: "/support/$ticketId",
                              params: { ticketId: n.ticketId },
                            });
                            return;
                          }
                          if (n.ticketId.startsWith("DT-")) {
                            void navigate({ to: "/tickets", search: { filter: "pending" } });
                            return;
                          }
                          void navigate({
                            to: "/tickets/$ticketId",
                            params: { ticketId: n.ticketId },
                          });
                        }
                      }}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.readAt ? "bg-transparent" : (kindDot[n.kind] ?? kindDot.info),
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">{n.title}</span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
