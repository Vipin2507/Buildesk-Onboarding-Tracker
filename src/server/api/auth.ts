import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import {
  ApiError,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  nowIso,
  requireUser,
  resultErr,
  resultOk,
  toPublicUser,
  verifyPassword,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { getCookie } from "@tanstack/react-start/server";

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(6),
});

export const authMe = createServerFn({ method: "GET" }).handler(async () => {
  const user = getSessionUser();
  return { user };
});

export const authLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginInput.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    const row = db.select().from(users).where(eq(users.email, email)).get();
    if (!row) return resultErr("No account found with that email.");
    if (!row.active) return resultErr("This account is inactive. Contact your admin.");
    const ok = await verifyPassword(data.password, row.passwordHash);
    if (!ok) return resultErr("Incorrect password. Try again.");
    await createSession(row.id);
    return resultOk({ user: toPublicUser(row) });
  });

export const authRegister = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerInput.parse(data))
  .handler(async () => {
    // Public self-registration is disabled. Admins create accounts via Settings → Invite User.
    return resultErr("Self-registration is disabled. Ask an Admin to invite you.");
  });

export const authLogout = createServerFn({ method: "POST" }).handler(async () => {
  const sessionId = getCookie(SESSION_COOKIE);
  if (sessionId) destroySession(sessionId);
  else clearSessionCookie();
  return resultOk(true);
});

export const authChangePassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => changePasswordInput.parse(data))
  .handler(async ({ data }) => {
    try {
      const user = requireUser();
      const db = getDb();
      const row = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!row) return resultErr("User not found");
      const ok = await verifyPassword(data.currentPassword, row.passwordHash);
      if (!ok) return resultErr("Current password is incorrect.");
      if (data.nextPassword === data.currentPassword) {
        return resultErr("New password must be different from the current one.");
      }
      const passwordHash = await hashPassword(data.nextPassword);
      db.update(users)
        .set({ passwordHash, updatedAt: nowIso() })
        .where(eq(users.id, user.id))
        .run();
      return resultOk(true);
    } catch (e) {
      if (e instanceof ApiError) return resultErr(e.message);
      throw e;
    }
  });

export const authUpdateProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        jobTitle: z.string().optional().nullable(),
        department: z.string().optional().nullable(),
        timezone: z.string().optional().nullable(),
        bio: z.string().optional().nullable(),
        avatarUrl: z.string().optional().nullable(),
        notifyEmail: z.boolean().optional(),
        notifyInApp: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const clash = db.select().from(users).where(eq(users.email, email)).get();
      if (clash && clash.id !== user.id) throw new ApiError(400, "Email already in use");
    }
    db.update(users)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle || null } : {}),
        ...(data.department !== undefined ? { department: data.department || null } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone || null } : {}),
        ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        ...(data.notifyEmail !== undefined ? { notifyEmail: data.notifyEmail } : {}),
        ...(data.notifyInApp !== undefined ? { notifyInApp: data.notifyInApp } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(users.id, user.id))
      .run();
    const row = db.select().from(users).where(eq(users.id, user.id)).get()!;
    return resultOk({ user: toPublicUser(row) });
  });
