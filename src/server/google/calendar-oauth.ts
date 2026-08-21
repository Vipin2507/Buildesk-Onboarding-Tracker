import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { eq } from "drizzle-orm";

import { nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

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
  googleEmail?: string;
  calendarId?: string;
  syncEnabled: boolean;
  connectedAt?: string;
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

export function signGoogleOAuthState(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyGoogleOAuthState(state: string, maxAgeMs = 15 * 60 * 1000) {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const [userId, tsStr, sig] = parts;
    if (!userId || !tsStr || !sig) return null;
    const payload = `${userId}.${tsStr}`;
    const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
    return userId;
  } catch {
    return null;
  }
}

export function buildGoogleCalendarAuthUrl(userId: string) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_CALENDAR_SCOPES],
    state: signGoogleOAuthState(userId),
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

export function getGoogleCalendarStatus(userId: string): GoogleCalendarConnectionStatus {
  const configured = isGoogleCalendarConfigured() && Boolean(googleCalendarRedirectUri());
  const row = getGoogleCalendarConnection(userId);
  if (!row) {
    return { configured, connected: false, syncEnabled: true };
  }
  return {
    configured,
    connected: true,
    googleEmail: row.googleEmail,
    calendarId: row.calendarId,
    syncEnabled: row.syncEnabled,
    connectedAt: row.connectedAt,
  };
}

export async function exchangeGoogleCalendarCode(code: string, userId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Disconnect the app in Google Account permissions and try again.",
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
  const existing = getGoogleCalendarConnection(userId);
  const values = {
    userId,
    googleEmail,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: expiresAt,
    calendarId: existing?.calendarId ?? "primary",
    scopes,
    syncEnabled: existing?.syncEnabled ?? true,
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

/** Returns an authenticated OAuth2 client, refreshing tokens when needed. */
export async function getAuthorizedGoogleClient(userId: string) {
  const row = getGoogleCalendarConnection(userId);
  if (!row) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: new Date(row.tokenExpiresAt).getTime(),
  });

  const expiresMs = new Date(row.tokenExpiresAt).getTime();
  if (expiresMs - Date.now() < 60_000) {
    const refreshed = await client.refreshAccessToken();
    const tokens = refreshed.credentials;
    if (tokens.access_token) {
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 55 * 60 * 1000).toISOString();
      getDb()
        .update(t.userGoogleCalendar)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? row.refreshToken,
          tokenExpiresAt: expiresAt,
          updatedAt: nowIso(),
        })
        .where(eq(t.userGoogleCalendar.userId, userId))
        .run();
      client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? row.refreshToken,
        expiry_date: new Date(expiresAt).getTime(),
      });
    }
  }

  return { client, connection: getGoogleCalendarConnection(userId)! };
}

export function meetRequestId(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}
