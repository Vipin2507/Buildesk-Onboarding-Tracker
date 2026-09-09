/** CRM Support sidebar blue — used for embed mode accents. */
export const PORTAL_CRM_EMBED_PRIMARY = "#1e60d5";

/** Portal content/page background (matches CRM shell). */
export const PORTAL_PAGE_BACKGROUND = "#ffffff";

/** Default palette aligned with typical CRM shells (white bar + slate text). */
export const PORTAL_EMBED_THEME_DEFAULTS = {
  background: PORTAL_PAGE_BACKGROUND,
  foreground: "#334155",
  mutedForeground: "#64748b",
  border: "#e5e7eb",
  card: "#ffffff",
  muted: "#f8f9fa",
  primary: PORTAL_CRM_EMBED_PRIMARY,
} as const;

export type PortalEmbedTheme = {
  background?: string;
  foreground?: string;
  mutedForeground?: string;
  border?: string;
  card?: string;
  muted?: string;
  primary?: string;
};

export type PortalEmbedThemeResolved = {
  [K in keyof typeof PORTAL_EMBED_THEME_DEFAULTS]: string;
};

function normalizeHexColor(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return undefined;
  return `#${raw.toLowerCase()}`;
}

function readThemeParam(...keys: string[]): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  for (const key of keys) {
    const hit = normalizeHexColor(params.get(key));
    if (hit) return hit;
  }
  return undefined;
}

export function readPortalEmbedThemeFromUrl(): PortalEmbedTheme {
  return {
    background: readThemeParam("embedBg", "bg"),
    foreground: readThemeParam("embedFg", "fg", "text"),
    mutedForeground: readThemeParam("embedMuted", "muted"),
    border: readThemeParam("embedBorder", "border"),
    card: readThemeParam("embedCard", "card"),
    muted: readThemeParam("embedMutedBg", "mutedBg"),
    primary: readThemeParam("embedPrimary", "primary"),
  };
}

export function mergePortalEmbedTheme(
  ...layers: (PortalEmbedTheme | null | undefined)[]
): PortalEmbedThemeResolved {
  return {
    ...PORTAL_EMBED_THEME_DEFAULTS,
    ...layers.reduce<PortalEmbedTheme>((acc, layer) => ({ ...acc, ...layer }), {}),
  };
}

export function portalEmbedThemeToCssVars(theme: PortalEmbedThemeResolved): Record<string, string> {
  const pageBg = PORTAL_PAGE_BACKGROUND;

  return {
    "--background": pageBg,
    "--foreground": theme.foreground,
    "--card": theme.card,
    "--card-foreground": theme.foreground,
    "--popover": theme.card,
    "--popover-foreground": theme.foreground,
    "--muted": theme.muted,
    "--muted-foreground": theme.mutedForeground,
    "--border": theme.border,
    "--input": theme.border,
    "--primary": theme.primary,
    "--primary-foreground": "#ffffff",
    "--accent": theme.primary,
    "--info": theme.primary,
    "--ring": theme.primary,
    "--brand": theme.primary,
    "--portal-embed-primary": theme.primary,
    "--portal-embed-bg": pageBg,
    "--portal-embed-fg": theme.foreground,
    "--portal-embed-muted": theme.mutedForeground,
    "--portal-embed-border": theme.border,
  };
}

export function parsePortalEmbedThemeMessage(data: unknown): PortalEmbedTheme | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  if (payload.type !== "buildesk-portal-theme") return null;
  const theme = payload.theme;
  if (!theme || typeof theme !== "object") return null;
  const raw = theme as Record<string, unknown>;
  return {
    background: normalizeHexColor(typeof raw.background === "string" ? raw.background : undefined),
    foreground: normalizeHexColor(typeof raw.foreground === "string" ? raw.foreground : undefined),
    mutedForeground: normalizeHexColor(
      typeof raw.mutedForeground === "string" ? raw.mutedForeground : undefined,
    ),
    border: normalizeHexColor(typeof raw.border === "string" ? raw.border : undefined),
    card: normalizeHexColor(typeof raw.card === "string" ? raw.card : undefined),
    muted: normalizeHexColor(typeof raw.muted === "string" ? raw.muted : undefined),
    primary: normalizeHexColor(typeof raw.primary === "string" ? raw.primary : undefined),
  };
}
