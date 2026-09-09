import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  CheckCircle2,
  UserRound,
  Building2,
  Menu,
  Calendar,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import {
  PortalEmbedProvider,
  usePortalEmbedMode,
  usePortalEmbedThemeStyle,
} from "@/components/portal-embed-context";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggleCompact } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { getStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PortalContentScope } from "@/components/portal-content-context";
import { PortalDesignTicketBootstrap } from "@/components/portal-design-ticket-bootstrap";
import { PortalChatBootstrap } from "@/components/chat/portal-chat-bootstrap";
import { PortalChatWidget } from "@/components/chat/portal-chat-widget";

const NAV = [
  { to: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { to: "create-ticket", label: "Create ticket", shortLabel: "Create", icon: PlusCircle },
  { to: "tickets", label: "My tickets", shortLabel: "Tickets", icon: Ticket },
  { to: "solved", label: "Solved", shortLabel: "Solved", icon: CheckCircle2 },
  { to: "book", label: "Book a call", shortLabel: "Book", icon: Calendar },
  { to: "profile", label: "Profile", shortLabel: "Profile", icon: UserRound },
] as const;

export function PortalInactiveState({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: TICKET_EASE }}
        className="max-w-md text-center"
      >
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      </motion.div>
    </div>
  );
}

function portalRoute(segment: string, slug: string) {
  switch (segment) {
    case "dashboard":
      return { to: "/portal/$slug/dashboard" as const, params: { slug } };
    case "create-ticket":
      return { to: "/portal/$slug/create-ticket" as const, params: { slug } };
    case "tickets":
      return { to: "/portal/$slug/tickets" as const, params: { slug } };
    case "solved":
      return { to: "/portal/$slug/solved" as const, params: { slug } };
    case "book":
      return { to: "/portal/$slug/book" as const, params: { slug } };
    case "profile":
      return { to: "/portal/$slug/profile" as const, params: { slug } };
    default:
      return { to: "/portal/$slug/dashboard" as const, params: { slug } };
  }
}

function PortalNavLink({
  slug,
  segment,
  label,
  icon: Icon,
  active,
  onNavigate,
  compact,
  embedded,
}: {
  slug: string;
  segment: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onNavigate?: () => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const route = portalRoute(segment, slug);
  return (
    <Link
      to={route.to}
      params={route.params}
      onClick={onNavigate}
      data-active={embedded && active ? "true" : undefined}
      className={cn(
        "relative flex shrink-0 items-center transition-colors duration-200",
        embedded
          ? "portal-embed-tab inline-flex items-center gap-1.5 whitespace-nowrap"
          : cn(
              "gap-2.5 rounded-lg transition-all duration-300",
              compact
                ? "flex-col gap-1 px-2 py-1.5 text-[10px] font-medium"
                : "px-3 py-2.5 text-sm",
              active
                ? compact
                  ? "text-primary"
                  : "bg-primary/10 font-medium text-primary"
                : compact
                  ? "text-muted-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ),
      )}
    >
      {active && !compact && !embedded ? (
        <motion.span
          layoutId="portal-nav-indicator"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      ) : null}
      <Icon className={cn("shrink-0", embedded ? "mr-1.5 h-3.5 w-3.5" : compact ? "h-5 w-5" : "h-4 w-4")} />
      <span className={compact && !embedded ? "max-w-[4.5rem] truncate" : undefined}>{label}</span>
    </Link>
  );
}

function ClientPortalLayoutInner({ access }: { access: CompanyPortalAccess }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const embedded = usePortalEmbedMode();
  const themeStyle = usePortalEmbedThemeStyle();
  const { setMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/portal/${access.slug}`;

  useEffect(() => {
    if (embedded || getStoredTheme() === "system") {
      setMode("light");
    }
  }, [embedded, setMode]);

  function isActive(segment: string) {
    if (segment === "dashboard") {
      return pathname === base || pathname === `${base}/` || pathname.endsWith("/dashboard");
    }
    return pathname.includes(`/${segment}`);
  }

  const navLinks = (
    <>
      {NAV.map(({ to, label, shortLabel, icon }) => (
        <PortalNavLink
          key={to}
          slug={access.slug}
          segment={to}
          label={embedded ? label : shortLabel}
          icon={icon}
          active={isActive(to)}
          onNavigate={menuOpen ? () => setMenuOpen(false) : undefined}
          compact={!embedded}
          embedded={embedded}
        />
      ))}
    </>
  );

  if (embedded) {
    return (
      <div
        style={themeStyle}
        className="portal-shell portal-embedded flex min-h-[100dvh] flex-col bg-background text-foreground"
      >
        <PortalDesignTicketBootstrap access={access} />
        <PortalChatBootstrap access={access} />
        <PortalChatWidget access={access} />

        <nav aria-label="Support portal" className="portal-embed-nav sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 py-0 sm:px-5">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground sm:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto sm:flex">
              {navLinks}
            </div>
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto bg-background">
          <PortalContentScope>
            <Outlet />
          </PortalContentScope>
        </main>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="flex w-[min(100%,16rem)] flex-col gap-0 p-0">
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle className="text-sm font-medium">Support</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-0.5 p-2">
              {NAV.map(({ to, label, icon }) => (
                <PortalNavLink
                  key={to}
                  slug={access.slug}
                  segment={to}
                  label={label}
                  icon={icon}
                  active={isActive(to)}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="portal-shell flex min-h-[100dvh] bg-background text-foreground">
      <PortalDesignTicketBootstrap access={access} />
      <PortalChatBootstrap access={access} />
      <PortalChatWidget access={access} />
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/50 md:flex">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              B
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{access.companyName}</div>
              <div className="text-[10px] text-muted-foreground">Client Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(({ to, label, icon }) => (
            <PortalNavLink
              key={to}
              slug={access.slug}
              segment={to}
              label={label}
              icon={icon}
              active={isActive(to)}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-4 md:h-16 md:px-6">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card md:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{access.companyName}</div>
            <div className="hidden text-xs text-muted-foreground sm:block">
              Client ticket portal
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggleCompact className="h-9 w-9 rounded-lg" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: TICKET_EASE }}
            className="flex-1 overflow-auto"
          >
            <PortalContentScope>
              <Outlet />
            </PortalContentScope>
          </motion.main>
        </AnimatePresence>

        <nav className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch justify-around border-t bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
          {NAV.map(({ to, shortLabel, icon }) => (
            <PortalNavLink
              key={to}
              slug={access.slug}
              segment={to}
              label={shortLabel}
              icon={icon}
              active={isActive(to)}
              compact
            />
          ))}
        </nav>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[min(100%,18rem)] flex-col gap-0 p-0">
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle className="text-base">{access.companyName}</SheetTitle>
            <p className="text-xs text-muted-foreground">Welcome, {access.contactName}</p>
          </SheetHeader>
          <nav className="flex-1 space-y-0.5 p-3">
            {NAV.map(({ to, label, icon }) => (
              <PortalNavLink
                key={to}
                slug={access.slug}
                segment={to}
                label={label}
                icon={icon}
                active={isActive(to)}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
          </nav>
          <div className="border-t p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Appearance</span>
              <ThemeToggleCompact className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ClientPortalLayout({ access }: { access: CompanyPortalAccess }) {
  return (
    <PortalEmbedProvider>
      <ClientPortalLayoutInner access={access} />
    </PortalEmbedProvider>
  );
}
