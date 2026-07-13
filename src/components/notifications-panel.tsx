import { useNavigate, useRouter } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCurrentUser, useNotificationStore } from "@/stores";
import { formatRelativeTime } from "@/types/common";

const kindDot: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.readAt).length;
  const inAppEnabled = currentUser?.notifyInApp !== false;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground transition-colors hover:text-foreground"
          title="Notifications"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {inAppEnabled && unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-1.5rem,22rem)] border-border bg-popover p-0 text-popover-foreground shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5">
          <div className="text-sm font-semibold">Notifications</div>
          {inAppEnabled && unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={() => markAllRead()}
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
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                      !n.readAt && "bg-primary/5",
                    )}
                    onClick={() => {
                      markRead(n.id);
                      if (n.ticketId) {
                        void navigate({
                          to: "/support/$ticketId",
                          params: { ticketId: n.ticketId },
                        });
                      } else if (n.href) {
                        void router.navigate({ to: n.href });
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
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
