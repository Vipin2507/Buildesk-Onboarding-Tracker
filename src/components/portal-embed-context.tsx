import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { detectPortalEmbedMode } from "@/lib/portal-embed-mode";
import {
  mergePortalEmbedTheme,
  parsePortalEmbedThemeMessage,
  portalEmbedThemeToCssVars,
  readPortalEmbedThemeFromUrl,
  type PortalEmbedTheme,
} from "@/lib/portal-embed-theme";

type PortalEmbedContextValue = {
  embedded: boolean;
  themeStyle: CSSProperties | undefined;
};

const PortalEmbedContext = createContext<PortalEmbedContextValue>({
  embedded: false,
  themeStyle: undefined,
});

export function PortalEmbedProvider({ children }: { children: ReactNode }) {
  const [embedded, setEmbedded] = useState(false);
  const [messageTheme, setMessageTheme] = useState<PortalEmbedTheme | null>(null);

  useEffect(() => {
    setEmbedded(detectPortalEmbedMode());
  }, []);

  const themeStyle = useMemo(() => {
    if (!embedded) return undefined;
    const theme = mergePortalEmbedTheme(readPortalEmbedThemeFromUrl(), messageTheme);
    return portalEmbedThemeToCssVars(theme) as CSSProperties;
  }, [embedded, messageTheme]);

  useEffect(() => {
    if (!embedded) return;

    const root = document.documentElement;
    root.classList.add("portal-embed-active");
    return () => {
      root.classList.remove("portal-embed-active");
      for (const key of [
        "--portal-embed-bg",
        "--portal-embed-fg",
        "--portal-embed-muted",
        "--portal-embed-border",
        "--portal-embed-primary",
        "--background",
        "--foreground",
        "--primary",
        "--primary-foreground",
        "--accent",
        "--info",
        "--ring",
        "--brand",
      ]) {
        root.style.removeProperty(key);
      }
    };
  }, [embedded]);

  useEffect(() => {
    if (!embedded || !themeStyle) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(themeStyle)) {
      if (typeof value === "string") root.style.setProperty(key, value);
    }
  }, [embedded, themeStyle]);

  useEffect(() => {
    if (!embedded) return;

    function onMessage(event: MessageEvent) {
      const next = parsePortalEmbedThemeMessage(event.data);
      if (next) setMessageTheme(next);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedded]);

  const value = useMemo(() => ({ embedded, themeStyle }), [embedded, themeStyle]);

  return <PortalEmbedContext.Provider value={value}>{children}</PortalEmbedContext.Provider>;
}

export function usePortalEmbedMode() {
  return useContext(PortalEmbedContext).embedded;
}

export function usePortalEmbedThemeStyle() {
  return useContext(PortalEmbedContext).themeStyle;
}
