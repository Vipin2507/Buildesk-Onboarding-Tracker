import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

import type { User, UserRole } from "@/types";
import { getDb } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";

export const SESSION_COOKIE = "buildesk_session";
const SESSION_DAYS = 14;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function sessionExpiryIso() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function toPublicUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    active: row.active,
    avatarUrl: row.avatarUrl ?? undefined,
    phone: row.phone ?? undefined,
    jobTitle: row.jobTitle ?? undefined,
    department: row.department ?? undefined,
    timezone: row.timezone ?? undefined,
    bio: row.bio ?? undefined,
    notifyEmail: row.notifyEmail ?? true,
    notifyInApp: row.notifyInApp ?? true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSession(userId: string) {
  const db = getDb();
  const id = randomBytes(32).toString("hex");
  const expiresAt = sessionExpiryIso();
  db.insert(sessions)
    .values({ id, userId, expiresAt, createdAt: nowIso() })
    .run();
  // Secure cookies are ignored by browsers on plain HTTP (e.g. http://VPS_IP).
  // Set COOKIE_SECURE=true only when serving over HTTPS.
  const secure = ["1", "true", "yes"].includes((process.env.COOKIE_SECURE ?? "").toLowerCase());
  setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return id;
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE);
}

export function destroySession(sessionId: string) {
  const db = getDb();
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  clearSessionCookie();
}

export function getSessionUser(): User | null {
  const sessionId = getCookie(SESSION_COOKIE);
  if (!sessionId) return null;
  const db = getDb();
  const row = db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, nowIso())))
    .get();

  if (!row || !row.user.active) return null;
  return toPublicUser(row.user);
}

export function requireUser(roles?: UserRole[]): User {
  const user = getSessionUser();
  if (!user) throw new ApiError(401, "Sign in required");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission for this action");
  }
  return user;
}

export function resultOk<T>(data: T) {
  return { success: true as const, data };
}

export function resultErr(error: string) {
  return { success: false as const, error };
}
