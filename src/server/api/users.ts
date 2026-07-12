import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, hashPassword, newId, nowIso, requireUser, toPublicUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { Employee } from "@/types";

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  requireUser(["Admin", "Manager"]);
  return getDb()
    .select()
    .from(t.users)
    .orderBy(asc(t.users.name))
    .all()
    .map(toPublicUser);
});

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        role: z.enum(["Admin", "Manager", "Viewer"]),
        active: z.boolean().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        department: z.string().optional(),
        password: z.string().min(6).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    if (db.select().from(t.users).where(eq(t.users.email, email)).get()) {
      throw new ApiError(400, "Email already exists");
    }
    const id = newId();
    const now = nowIso();
    const passwordHash = await hashPassword(data.password ?? "buildesk123");
    db.insert(t.users)
      .values({
        id,
        name: data.name.trim(),
        email,
        passwordHash,
        role: data.role,
        active: data.active ?? true,
        phone: data.phone,
        jobTitle: data.jobTitle,
        department: data.department,
        notifyEmail: true,
        notifyInApp: true,
        timezone: "Asia/Kolkata",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return toPublicUser(db.select().from(t.users).where(eq(t.users.id, id)).get()!);
  });

export const updateUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["Admin", "Manager", "Viewer"]).optional(),
          active: z.boolean().optional(),
          phone: z.string().optional().nullable(),
          jobTitle: z.string().optional().nullable(),
          department: z.string().optional().nullable(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    getDb()
      .update(t.users)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.users.id, data.id))
      .run();
    const row = getDb().select().from(t.users).where(eq(t.users.id, data.id)).get();
    if (!row) throw new ApiError(404, "User not found");
    return toPublicUser(row);
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const me = requireUser(["Admin"]);
    if (me.id === data.id) throw new ApiError(400, "Cannot delete your own account");
    getDb().delete(t.users).where(eq(t.users.id, data.id)).run();
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.employees).orderBy(asc(t.employees.name)).all() as Employee[];
});

export const createEmployee = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string(), role: z.string(), region: z.string(), email: z.string().email() }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const now = nowIso();
    const id = newId();
    getDb()
      .insert(t.employees)
      .values({ id, ...data, createdAt: now, updatedAt: now })
      .run();
    return { id, ...data, role: data.role as Employee["role"], createdAt: now, updatedAt: now } satisfies Employee;
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({
          name: z.string().optional(),
          role: z.string().optional(),
          region: z.string().optional(),
          email: z.string().optional(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb()
      .update(t.employees)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.employees.id, data.id))
      .run();
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    getDb().delete(t.employees).where(eq(t.employees.id, data.id)).run();
    return { ok: true };
  });
