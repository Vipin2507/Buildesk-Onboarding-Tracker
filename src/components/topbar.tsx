import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  ChevronDown,
  LogOut,
  Settings,
  User,
  UserRound,
  Menu,
} from "lucide-react";
import { toast } from "sonner";

import { EditProfileDialog } from "@/components/edit-profile-dialog";
import {
  GlobalSearchDropdown,
  type GlobalSearchScope,
} from "@/components/global-search-dropdown";
import { MobileNavSheet } from "@/components/mobile-nav-sheet";
import { NotificationsBell } from "@/components/notifications-panel";
import { ThemeToggle, ThemeToggleCompact } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionFilter } from "@/hooks/use-session-filter";
import { useGlobalSearch, useAuthStore, useCurrentUser } from "@/stores";
import { authLogout } from "@/lib/api";
import { isCrmUser } from "@/lib/product-scope";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const currentUser = useCurrentUser();
  const crm = isCrmUser(currentUser);
  const [searchScope, setSearchScope] = useSessionFilter<GlobalSearchScope>(
    "global.search.scope",
    crm ? "crm" : "erp",
  );
  const results = useGlobalSearch(query);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const ref = useRef<HTMLDivElement>(null);

  const canSearchCrm = crm;
  const canSearchErp = !crm;

  useEffect(() => {
    setSearchScope(crm ? "crm" : "erp");
  }, [crm]);

  const showSearchPanel = open && query.length > 0;
  const initials = currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "??";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    try {
      await authLogout();
    } catch {
      // Session may already be invalid — still clear local auth.
    }
    setUser(null);
    toast.success("Signed out");
    try {
      await navigate({ to: "/login", search: { mode: "login" }, replace: true });
    } catch {
      // AuthGate will also redirect if this fails.
    }
  }

  function closeSearch() {
    setQuery("");
    setOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:h-16 md:gap-4 md:px-6">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground md:hidden"
          aria-label="Open menu"
          onClick={() => setNavOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative min-w-0 max-w-xl flex-1" ref={ref}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              searchScope === "crm"
                ? "Search CRM accounts, tasks…"
                : "Search ERP companies, projects, tasks…"
            }
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
            aria-label={
              searchScope === "crm"
                ? "Search CRM accounts and tasks"
                : "Search ERP companies, projects, tasks, and visits"
            }
          />
          {showSearchPanel ? (
            <GlobalSearchDropdown
              results={results}
              scope={searchScope}
              onScopeChange={setSearchScope}
              canSearchCrm={canSearchCrm}
              canSearchErp={canSearchErp}
              onClose={closeSearch}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <ThemeToggle className="hidden sm:inline-flex" />
          <ThemeToggleCompact className="sm:hidden" />

          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border bg-card p-1.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 md:pr-2.5"
              >
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="h-7 w-7 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </div>
                )}
                <div className="hidden text-left leading-tight md:block">
                  <div className="text-xs font-semibold">{currentUser?.name ?? "User"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {currentUser?.jobTitle ?? currentUser?.role ?? "—"}
                  </div>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{currentUser?.name}</div>
                <div className="text-xs text-muted-foreground">{currentUser?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <UserRound className="mr-2 h-4 w-4" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void navigate(
                    crm
                      ? { to: "/crm/settings", search: { section: undefined, invite: false } }
                      : { to: "/settings", search: { section: undefined, invite: false } },
                  )
                }
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              {currentUser?.role === "Admin" && !crm && (
                <DropdownMenuItem
                  onClick={() =>
                    void navigate({
                      to: "/settings",
                      search: { section: "users", invite: true },
                    })
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  Invite user
                </DropdownMenuItem>
              )}
              {currentUser?.role === "Admin" && crm && (
                <DropdownMenuItem
                  onClick={() =>
                    void navigate({
                      to: "/crm/settings",
                      search: { section: "users", invite: true },
                    })
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  Invite CRM user
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen} />
      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
