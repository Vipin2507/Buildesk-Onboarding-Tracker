import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  CheckCircle2,
  Clock,
  UserRound,
  LogOut,
  Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "create-ticket", label: "Create New Ticket", icon: PlusCircle },
  { to: "tickets", label: "My Tickets", icon: Ticket },
  { to: "solved", label: "Solved Tickets", icon: CheckCircle2 },
  { to: "profile", label: "Profile", icon: UserRound },
] as const;

export function PortalInactiveState({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}

export function ClientPortalLayout({ access }: { access: CompanyPortalAccess }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const base = `/portal/${access.slug}`;

  function navTo(segment: string) {
    return `${base}/${segment}`;
  }

  function isActive(segment: string) {
    if (segment === "dashboard") {
      return pathname === base || pathname === `${base}/` || pathname.endsWith("/dashboard");
    }
    return pathname.includes(`/${segment}`);
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/50 md:flex">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              B
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{access.companyName}</div>
              <div className="text-[10px] text-muted-foreground">Client Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={navTo(to)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive(to)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
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
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur md:h-16 md:px-6">
          <div className="min-w-0 md:hidden">
            <div className="truncate text-sm font-semibold">{access.companyName}</div>
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="text-sm font-semibold">{access.companyName}</div>
            <div className="text-xs text-muted-foreground">Design & support tracking</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Welcome, <span className="font-medium">{access.contactName}</span>
            </span>
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-auto"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
