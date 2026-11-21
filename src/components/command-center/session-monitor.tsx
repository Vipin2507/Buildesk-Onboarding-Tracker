import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { monitoringHeartbeat, monitoringNavigation } from "@/server/api/command-center";
import { useAuthStore } from "@/stores";

function scopeOf(pathname: string) {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/crm")) return "crm";
  return "erp";
}

function moduleOf(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (pathname.startsWith("/admin")) return parts[1] || "overview";
  if (pathname.startsWith("/crm")) return parts[1] || "dashboard";
  return parts[0] || "dashboard";
}

/** Records a heartbeat and a page-open event for the signed-in user. Does not render UI. */
export function SessionMonitor() {
  const user = useAuthStore((s) => s.user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef("");

  useEffect(() => {
    if (!user || pathname === "/login" || pathname.startsWith("/portal")) return;
    const application = scopeOf(pathname);
    const module = moduleOf(pathname);
    let timer = 0;
    const beat = () => {
      if (document.visibilityState === "hidden") return;
      void monitoringHeartbeat({ data: { application, module } }).then((result) => {
        const seconds =
          result.success && "heartbeatSeconds" in result.data ? result.data.heartbeatSeconds : 60;
        window.clearInterval(timer);
        timer = window.setInterval(beat, Math.max(30, seconds) * 1000);
      });
    };
    beat();
    return () => window.clearInterval(timer);
  }, [user, pathname]);

  useEffect(() => {
    if (!user || pathname === "/login" || pathname.startsWith("/portal")) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void monitoringNavigation({
      data: { application: scopeOf(pathname), module: moduleOf(pathname) },
    });
  }, [user, pathname]);

  return null;
}
