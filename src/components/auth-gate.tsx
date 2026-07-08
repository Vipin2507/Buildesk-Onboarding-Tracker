import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuthStore } from "@/stores";

const PUBLIC_PATHS = ["/login"];

export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!currentUserId && !isPublic) {
      navigate({ to: "/login", search: { mode: "login" }, replace: true });
    } else if (currentUserId && isPublic) {
      navigate({ to: "/", replace: true });
    }
  }, [currentUserId, isPublic, navigate]);

  if (!currentUserId && !isPublic) return null;
  if (currentUserId && isPublic) return null;

  return <>{children}</>;
}
