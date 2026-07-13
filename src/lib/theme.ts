export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "buildesk-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
}

/** Apply theme with optional circular reveal from a click point. */
export function setTheme(mode: ThemeMode, origin?: { x: number; y: number }) {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  const isDark = resolved === "dark";

  const run = () => applyThemeClass(resolved);

  if (
    origin &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    root.style.setProperty("--theme-x", `${origin.x}px`);
    root.style.setProperty("--theme-y", `${origin.y}px`);
    // Direction hint for clip reveal
    root.dataset.themeTo = resolved;
    const transition = document.startViewTransition(() => {
      run();
    });
    void transition.finished.finally(() => {
      delete root.dataset.themeTo;
    });
    return;
  }

  // Fallback: brief CSS transition class
  root.classList.add("theme-animating");
  run();
  window.setTimeout(() => root.classList.remove("theme-animating"), 450);
}

/** Inline script for shell <head> — prevents light flash before React hydrates. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=t==="dark"||((t==null||t==="system")&&d);var r=document.documentElement;r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";r.dataset.theme=dark?"dark":"light";}catch(e){}})();`;
