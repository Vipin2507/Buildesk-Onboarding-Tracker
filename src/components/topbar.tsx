import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Search, ChevronDown, Building2, Boxes } from "lucide-react";
import { useGlobalSearch, useUserStore } from "@/stores";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useGlobalSearch(query);
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.users.find((u) => u.id === s.currentUserId));
  const ref = useRef<HTMLDivElement>(null);

  const hasResults = query.length > 0 && (results.companies.length > 0 || results.projects.length > 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur">
      <div className="relative flex-1 max-w-xl" ref={ref}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search company, project, manager…"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
        />
        {open && hasResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {results.companies.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => { navigate({ to: "/companies/$companyId", params: { companyId: c.id } }); setQuery(""); setOpen(false); }}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.city}</div></div>
              </button>
            ))}
            {results.projects.map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => { navigate({ to: "/projects/$projectId", params: { projectId: p.id }, search: { tab: "onboarding" } }); setQuery(""); setOpen(false); }}
              >
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.city}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-lg border bg-card p-1.5 pr-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "AK"}
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-semibold">{currentUser?.name ?? "Admin"}</div>
            <div className="text-[10px] text-muted-foreground">{currentUser?.role ?? "Admin"}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
