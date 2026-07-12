import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Search, ChevronDown, Building2, Boxes, LogOut, Settings, User, UserRound } from "lucide-react";
import { toast } from "sonner";

import { EditProfileDialog } from "@/components/edit-profile-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGlobalSearch, useAuthStore, useCurrentUser } from "@/stores";
import { authLogout } from "@/lib/api";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const results = useGlobalSearch(query);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useCurrentUser();
  const ref = useRef<HTMLDivElement>(null);

  const hasResults = query.length > 0 && (results.companies.length > 0 || results.projects.length > 0);
  const initials = currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "??";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    await authLogout();
    setUser(null);
    toast.success("Signed out");
    void navigate({ to: "/login", search: { mode: "login" } });
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur">
        <div className="relative max-w-xl flex-1" ref={ref}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search company, project, manager…"
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
          />
          {open && hasResults && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
              {results.companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    void navigate({ to: "/companies/$companyId", params: { companyId: c.id } });
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.city}</div>
                  </div>
                </button>
              ))}
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    void navigate({
                      to: "/projects/$projectId",
                      params: { projectId: p.id },
                      search: { tab: "onboarding" },
                    });
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.city}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border bg-card p-1.5 pr-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
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
                <div className="text-left leading-tight">
                  <div className="text-xs font-semibold">{currentUser?.name ?? "User"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {currentUser?.jobTitle ?? currentUser?.role ?? "—"}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
              <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void handleLogout().then(() =>
                    navigate({ to: "/login", search: { mode: "register" } }),
                  );
                }}
              >
                <User className="mr-2 h-4 w-4" />
                Add another account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
