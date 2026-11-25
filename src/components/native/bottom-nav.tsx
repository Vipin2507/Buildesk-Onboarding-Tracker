import { Link, useRouterState } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckSquare,
  IndianRupee,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { isCrmUser } from "@/lib/product-scope";
import { setMobileNavOpen, useKeyboardOpen, useMobileNavOpen } from "@/lib/native/shell-state";
import { useAuthStore } from "@/stores";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

function isActive(pathname: string, tab: Tab) {
  if (tab.exact) return pathname === tab.to;
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const navOpen = useMobileNavOpen();
  const keyboardOpen = useKeyboardOpen();
  const crm = isCrmUser(user);

  const tabs: Tab[] = crm
    ? [
        { to: "/crm", label: "Home", icon: LayoutDashboard, exact: true },
        { to: "/crm/accounts", label: "Accounts", icon: BriefcaseBusiness },
        { to: "/crm/tasks", label: "Tasks", icon: CheckSquare },
        { to: "/crm/payments", label: "Payments", icon: IndianRupee },
      ]
    : [
        { to: "/", label: "Home", icon: LayoutDashboard, exact: true },
        { to: "/companies", label: "Companies", icon: Building2 },
        can("manageTasks")
          ? { to: "/tasks", label: "Tasks", icon: CheckSquare }
          : can("manageErpMeetings")
            ? { to: "/meetings", label: "Meetings", icon: Calendar }
            : { to: "/payments", label: "Payments", icon: Wallet },
        { to: "/tickets", label: "Tickets", icon: MessageSquareText },
      ];

  const onTab = tabs.some((tab) => isActive(pathname, tab));

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label={crm ? "CRM shortcuts" : "ERP shortcuts"}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium",
                  active ? "font-semibold text-secondary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={cn(
              "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium",
              navOpen || !onTab
                ? "font-semibold text-secondary-foreground"
                : "text-muted-foreground",
            )}
            aria-expanded={navOpen}
            aria-label="Open the rest of the menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
