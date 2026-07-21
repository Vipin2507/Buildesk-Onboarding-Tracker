import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  CheckCircle2,
  Clock,
  UserRound,
  LogOut,
  Building2,
  Menu,
} from "lucide-react";
import { useState } from "react";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { cn } from "@/lib/utils";
import { PortalDesignTicketBootstrap } from "@/components/portal-design-ticket-bootstrap";

const NAV = [
  { to: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { to: "create-ticket", label: "Create New Ticket", shortLabel: "Create", icon: PlusCircle },
  { to: "tickets", label: "My Tickets", shortLabel: "Tickets", icon: Ticket },
  { to: "solved", label: "Solved Tickets", shortLabel: "Solved", icon: CheckCircle2 },
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
}: {
  slug: string;
  segment: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const route = portalRoute(segment, slug);
  return (
    <Link
      to={route.to}
      params={route.params}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg transition-all duration-300",
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
      )}
    >
      {active && !compact ? (
        <motion.span
          layoutId="portal-nav-indicator"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      ) : null}
      <Icon className={cn("shrink-0", compact ? "h-5 w-5" : "h-4 w-4")} />
      <span className={compact ? "max-w-[4.5rem] truncate" : undefined}>{label}</span>
    </Link>
  );
}

export function ClientPortalLayout({ access }: { access: CompanyPortalAccess }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/portal/${access.slug}`;

  function isActive(segment: string) {
    if (segment === "dashboard") {
      return pathname === base || pathname === `${base}/` || pathname.endsWith("/dashboard");
    }
    return pathname.includes(`/${segment}`);
  }

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <PortalDesignTicketBootstrap access={access} />
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
        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => void navigate({ to: "/login", search: { mode: "login" } })}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
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
              Design & support tracking
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Welcome, <span className="font-medium">{access.contactName}</span>
            </span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.28, ease: TICKET_EASE }}
            className="flex-1 overflow-auto"
          >
            <Outlet />
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
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                setMenuOpen(false);
                void navigate({ to: "/login", search: { mode: "login" } });
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
