import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { authMe } from "@/lib/api";
import { useAuthStore } from "@/stores";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/portal/");
}

export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authMe();
        if (!cancelled) setUser(res.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user && !isPublic) {
      void navigate({ to: "/login", search: { mode: "login" }, replace: true });
    } else if (user && isPublic) {
      void navigate({ to: "/", replace: true });
    }
  }, [user, hydrated, isPublic, navigate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (user && isPublic) return null;

  return <>{children}</>;
}
