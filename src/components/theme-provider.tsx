import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyThemeClass,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  setTheme as commitTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
  toggleLightDark: (origin?: { x: number; y: number }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? "system" : getStoredTheme(),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : resolveTheme(getStoredTheme()),
  );

  useEffect(() => {
    const stored = getStoredTheme();
    setModeState(stored);
    const next = resolveTheme(stored);
    setResolved(next);
    applyThemeClass(next);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() !== "system") return;
      const next = getSystemTheme();
      setResolved(next);
      applyThemeClass(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: ThemeMode, origin?: { x: number; y: number }) => {
    setModeState(next);
    setResolved(resolveTheme(next));
    commitTheme(next, origin);
  }, []);

  const toggleLightDark = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: ThemeMode = resolved === "dark" ? "light" : "dark";
      setMode(next, origin);
    },
    [resolved, setMode],
  );

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggleLightDark }),
    [mode, resolved, setMode, toggleLightDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
