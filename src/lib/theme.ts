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

const THEME_TRANSITION_MS = 700;

/** Apply theme with a calm crossfade (no circular wipe). */
export function setTheme(mode: ThemeMode, _origin?: { x: number; y: number }) {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  const run = () => applyThemeClass(resolved);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    run();
    return;
  }

  // Soft crossfade via View Transitions when available
  if (typeof document.startViewTransition === "function") {
    root.dataset.themeTransition = "fade";
    const transition = document.startViewTransition(() => {
      run();
    });
    void transition.finished.finally(() => {
      delete root.dataset.themeTransition;
    });
    return;
  }

  // Fallback: ease color tokens over ~700ms
  root.classList.add("theme-animating");
  run();
  window.setTimeout(() => root.classList.remove("theme-animating"), THEME_TRANSITION_MS);
}

/** Inline script for shell <head> — prevents light flash before React hydrates. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=t==="dark"||((t==null||t==="system")&&d);var r=document.documentElement;r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";r.dataset.theme=dark?"dark":"light";}catch(e){}})();`;
