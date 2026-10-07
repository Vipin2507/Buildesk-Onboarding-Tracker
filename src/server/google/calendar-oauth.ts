import { google } from "googleapis";
import { eq } from "drizzle-orm";

import { nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

async function nodeCrypto() {
  return import("node:crypto");
}

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export type GoogleCalendarConnectionStatus = {
  configured: boolean;
  connected: boolean;
  /** True when a row exists but Google rejected the refresh token — user must reconnect. */
  needsReconnect: boolean;
  googleEmail?: string;
  calendarId?: string;
  syncEnabled: boolean;
  connectedAt?: string;
  authError?: string;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function isGoogleCalendarConfigured() {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function googleCalendarRedirectUri() {
  const explicit = env("GOOGLE_REDIRECT_URI");
  if (explicit) return explicit;
  const base = env("APP_BASE_URL").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/auth/google/calendar/callback`;
}

function oauthClient() {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  const redirectUri = googleCalendarRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (or APP_BASE_URL).",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function stateSecret() {
  return env("SESSION_SECRET") || "buildesk-google-calendar";
}

export type GoogleOAuthReturnTarget = "crm" | "erp";

export async function signGoogleOAuthState(
  userId: string,
  returnTo: GoogleOAuthReturnTarget = "crm",
) {
  const { createHmac } = await nodeCrypto();
  const payload = `${userId}.${returnTo}.${Date.now()}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export async function verifyGoogleOAuthState(state: string, maxAgeMs = 15 * 60 * 1000) {
  try {
    const { createHmac, timingSafeEqual } = await nodeCrypto();
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3 && parts.length !== 4) return null;

    let userId: string;
    let returnTo: GoogleOAuthReturnTarget = "crm";
    let tsStr: string;
    let sig: string;

    if (parts.length === 4) {
      [userId, returnTo, tsStr, sig] = parts as [string, GoogleOAuthReturnTarget, string, string];
      if (returnTo !== "crm" && returnTo !== "erp") return null;
    } else {
      [userId, tsStr, sig] = parts as [string, string, string];
    }

    if (!userId || !tsStr || !sig) return null;
    const payload = parts.length === 4 ? `${userId}.${returnTo}.${tsStr}` : `${userId}.${tsStr}`;
    const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
    return { userId, returnTo };
  } catch {
    return null;
  }
}

export async function buildGoogleCalendarAuthUrl(
  userId: string,
  returnTo: GoogleOAuthReturnTarget = "crm",
) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_CALENDAR_SCOPES],
    state: await signGoogleOAuthState(userId, returnTo),
    include_granted_scopes: true,
  });
}

export function getGoogleCalendarConnection(userId: string) {
  return getDb()
    .select()
    .from(t.userGoogleCalendar)
    .where(eq(t.userGoogleCalendar.userId, userId))
    .get();
}

/** Connection exists and refresh token has not been marked revoked. */
export function hasUsableGoogleCalendarConnection(userId: string) {
  const row = getGoogleCalendarConnection(userId);
  return Boolean(row && !row.authError?.trim());
}

function mapStatus(
  row: typeof t.userGoogleCalendar.$inferSelect | undefined,
): GoogleCalendarConnectionStatus {
  const configured = isGoogleCalendarConfigured() && Boolean(googleCalendarRedirectUri());
  if (!row) {
    return { configured, connected: false, needsReconnect: false, syncEnabled: true };
  }
  const authError = row.authError?.trim() || undefined;
  return {
    configured,
    connected: true,
    needsReconnect: Boolean(authError),
    googleEmail: row.googleEmail,
    calendarId: row.calendarId,
    syncEnabled: row.syncEnabled,
    connectedAt: row.connectedAt,
    authError,
  };
}

export function getGoogleCalendarStatus(userId: string): GoogleCalendarConnectionStatus {
  return mapStatus(getGoogleCalendarConnection(userId));
}

function isGoogleAuthRevokedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("invalid_grant")) return true;
  if (lower.includes("invalid_client")) return true;
  if (lower.includes("token has been expired or revoked")) return true;
  if (lower.includes("deleted_client")) return true;
  const anyErr = err as { response?: { data?: { error?: string } }; code?: number | string };
  const code = anyErr?.response?.data?.error ?? anyErr?.code;
  return code === "invalid_grant" || code === "invalid_client";
}

function markGoogleAuthError(userId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const short = (message.includes("invalid_grant")
    ? "Google refresh token expired or revoked. Reconnect Google Calendar."
    : message
  ).slice(0, 500);
  console.warn(`[google-calendar] auth failed for user ${userId}:`, short);
  getDb()
    .update(t.userGoogleCalendar)
    .set({ authError: short, updatedAt: nowIso() })
    .where(eq(t.userGoogleCalendar.userId, userId))
    .run();
}

function persistGoogleTokens(
  userId: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  },
  existingRefreshToken: string,
) {
  if (!tokens.access_token) return;
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 55 * 60 * 1000).toISOString();
  getDb()
    .update(t.userGoogleCalendar)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existingRefreshToken,
      tokenExpiresAt: expiresAt,
      authError: null,
      updatedAt: nowIso(),
    })
    .where(eq(t.userGoogleCalendar.userId, userId))
    .run();
}

export async function exchangeGoogleCalendarCode(code: string, userId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  const existing = getGoogleCalendarConnection(userId);
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
  if (!tokens.access_token || !refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Open Google Account → Security → Third-party access, remove Buildesk, then connect again.",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  const googleEmail = me.data.email?.trim();
  if (!googleEmail) throw new Error("Could not read Google account email");

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 55 * 60 * 1000).toISOString();
  const now = nowIso();
  const scopes = Array.isArray(tokens.scope)
    ? tokens.scope.join(" ")
    : (tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "));

  const db = getDb();
  const values = {
    userId,
    googleEmail,
    accessToken: tokens.access_token,
    refreshToken,
    tokenExpiresAt: expiresAt,
    calendarId: existing?.calendarId ?? "primary",
    scopes,
    syncEnabled: existing?.syncEnabled ?? true,
    authError: null as string | null,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    db.update(t.userGoogleCalendar).set(values).where(eq(t.userGoogleCalendar.userId, userId)).run();
  } else {
    db.insert(t.userGoogleCalendar).values(values).run();
  }

  return getGoogleCalendarStatus(userId);
}

export function disconnectGoogleCalendar(userId: string) {
  getDb().delete(t.userGoogleCalendar).where(eq(t.userGoogleCalendar.userId, userId)).run();
}

export function setGoogleCalendarSyncEnabled(userId: string, syncEnabled: boolean) {
  const row = getGoogleCalendarConnection(userId);
  if (!row) throw new Error("Google Calendar is not connected");
  getDb()
    .update(t.userGoogleCalendar)
    .set({ syncEnabled, updatedAt: nowIso() })
    .where(eq(t.userGoogleCalendar.userId, userId))
    .run();
  return getGoogleCalendarStatus(userId);
}

/**
 * Returns an authenticated OAuth2 client, refreshing tokens when needed.
 * On invalid_grant / revoked tokens: marks auth_error and returns null (row kept for Reconnect UI).
 */
export async function getAuthorizedGoogleClient(userId: string) {
  const row = getGoogleCalendarConnection(userId);
  if (!row) return null;
  if (row.authError?.trim()) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: new Date(row.tokenExpiresAt).getTime(),
  });

  client.on("tokens", (tokens) => {
    try {
      persistGoogleTokens(userId, tokens, row.refreshToken);
    } catch (err) {
      console.warn("[google-calendar] failed to persist refreshed tokens", err);
    }
  });

  const expiresMs = new Date(row.tokenExpiresAt).getTime();
  if (expiresMs - Date.now() < 60_000) {
    try {
      const refreshed = await client.refreshAccessToken();
      const tokens = refreshed.credentials;
      if (tokens.access_token) {
        persistGoogleTokens(userId, tokens, row.refreshToken);
        client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? row.refreshToken,
          expiry_date: tokens.expiry_date ?? Date.now() + 55 * 60 * 1000,
        });
      }
    } catch (err) {
      if (isGoogleAuthRevokedError(err)) {
        markGoogleAuthError(userId, err);
        return null;
      }
      console.warn(
        `[google-calendar] temporary refresh failure for user ${userId}:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  return { client, connection: getGoogleCalendarConnection(userId)! };
}

/**
 * Status for UI — if access token is expired, attempts a refresh so "Connected"
 * becomes "Reconnect required" when Google has revoked the grant.
 */
export async function refreshGoogleCalendarStatus(userId: string): Promise<GoogleCalendarConnectionStatus> {
  const row = getGoogleCalendarConnection(userId);
  if (!row) return getGoogleCalendarStatus(userId);
  if (row.authError?.trim()) return mapStatus(row);

  const expiresMs = new Date(row.tokenExpiresAt).getTime();
  if (expiresMs - Date.now() < 60_000) {
    await getAuthorizedGoogleClient(userId);
  }
  return getGoogleCalendarStatus(userId);
}

export async function meetRequestId(seed: string) {
  const { createHash } = await nodeCrypto();
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}
