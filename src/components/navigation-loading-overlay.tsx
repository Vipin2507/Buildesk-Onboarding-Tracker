import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

import { AppLoadingScreen } from "@/components/app-loading-screen";

const MIN_VISIBLE_MS = 380;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Brief polished loader on pathname changes — not search/hash-only updates. */
export function NavigationLoadingOverlay() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const shownAt = useRef(0);
  const skipInitial = useRef(true);
  const settledPathname = useRef(pathname);
  const pathChangePending = useRef(false);

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      settledPathname.current = pathname;
      return;
    }

    if (pathname === settledPathname.current) return;

    pathChangePending.current = true;
    window.clearTimeout(hideTimer.current);
    setVisible(true);
    shownAt.current = Date.now();

    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      settledPathname.current = pathname;
      pathChangePending.current = false;
    }, MIN_VISIBLE_MS);

    return () => window.clearTimeout(hideTimer.current);
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) return;
    // Search/hash updates on the same page briefly go pending — ignore those.
    if (pathname === settledPathname.current && !pathChangePending.current) return;

    window.clearTimeout(hideTimer.current);
    setVisible(true);
    shownAt.current = Date.now();
  }, [isLoading, pathname]);

  useEffect(() => {
    if (isLoading) return;
    settledPathname.current = pathname;
    pathChangePending.current = false;
    const elapsed = Date.now() - shownAt.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), remaining);
  }, [isLoading, pathname]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="nav-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-background/55 backdrop-blur-[3px]"
          aria-busy
          aria-live="polite"
          aria-label="Loading page"
        >
          <AppLoadingScreen variant="overlay" message="Loading page…" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
