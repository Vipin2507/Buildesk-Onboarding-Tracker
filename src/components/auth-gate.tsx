import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { authMe } from "@/lib/api";
import { homePathForUser, isCrmUser } from "@/lib/product-scope";
import { useAuthStore } from "@/stores";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/portal/");
}

function isGoogleOAuthCallbackPath(pathname: string) {
  return pathname.startsWith("/auth/google/");
}

function RedirectingScreen({ message }: { message: string }) {
  return <AppLoadingScreen message={message} />;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const isPublic = isPublicPath(pathname);
  const isCrmPath = pathname === "/crm" || pathname.startsWith("/crm/");
  const isGoogleOAuthCallback = isGoogleOAuthCallbackPath(pathname);

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
      return;
    }
    if (user && isPublic) {
      void navigate({ to: homePathForUser(user), replace: true });
      return;
    }
    if (!user) return;

    // Let the OAuth callback finish before product-scope redirects.
    if (isGoogleOAuthCallback) return;

    const crmUser = isCrmUser(user);
    if (crmUser && !isCrmPath) {
      void navigate({ to: "/crm", replace: true });
    } else if (!crmUser && isCrmPath) {
      void navigate({ to: "/", replace: true });
    }
  }, [user, hydrated, isPublic, isCrmPath, isGoogleOAuthCallback, navigate]);

  if (!hydrated) {
    return <RedirectingScreen message="Loading session…" />;
  }

  // Avoid a blank white screen while the router catches up after sign-out / product redirects.
  if (!user && !isPublic) {
    return <RedirectingScreen message="Redirecting to sign in…" />;
  }
  if (user && isPublic) {
    return <RedirectingScreen message="Signing you in…" />;
  }

  if (user) {
    if (isGoogleOAuthCallback) {
      return <>{children}</>;
    }
    const crmUser = isCrmUser(user);
    if (crmUser && !isCrmPath) {
      return <RedirectingScreen message="Opening CRM…" />;
    }
    if (!crmUser && isCrmPath) {
      return <RedirectingScreen message="Opening ERP…" />;
    }
  }

  return <>{children}</>;
}
