import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ApiError, requireUser, resultErr, resultOk } from "@/server/auth/session";
import {
  buildOverview,
  crmSummary,
  employeeDetail,
  erpSummary,
  getMonitorConfig,
  heartbeat,
  listAudit,
  listEmployees,
  listEvents,
  listSecurity,
  listSessions,
  recordNavigation,
  requireAdmin,
  reviewSecurity,
  saveMonitorConfig,
  searchCommandCenter,
  systemHealth,
  terminateWorkSession,
  usageSplit,
  workSummary,
} from "@/server/lib/command-center";

const rangeInput = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
  app: z.enum(["all", "erp", "crm", "admin"]).default("all"),
});

function guard<T>(fn: () => T) {
  try {
    return resultOk(fn());
  } catch (error) {
    if (error instanceof ApiError) return resultErr(error.message);
    throw error;
  }
}

export const monitoringHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ application: z.string(), module: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const user = requireUser();
      return resultOk(heartbeat(user, data.application, data.module));
    } catch (error) {
      if (error instanceof ApiError) return resultErr(error.message);
      throw error;
    }
  });

export const monitoringNavigation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ application: z.string(), module: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const user = requireUser();
      recordNavigation(user, data.application, data.module);
      return resultOk(true);
    } catch (error) {
      if (error instanceof ApiError) return resultErr(error.message);
      throw error;
    }
  });

export const adminOverview = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) =>
    guard(() => (requireAdmin(), buildOverview(data.from, data.to, data.app))),
  );

export const adminEmployees = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        q: z.string().optional(),
        app: z.enum(["all", "erp", "crm", "admin"]).optional(),
        status: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => guard(() => (requireAdmin(), listEmployees(data))));

export const adminEmployee = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.extend({ id: z.string() }).parse(data))
  .handler(async ({ data }) =>
    guard(() => (requireAdmin(), employeeDetail(data.id, data.from, data.to))),
  );

export const adminEvents = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    rangeInput
      .extend({
        employeeId: z.string().optional(),
        eventType: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => guard(() => (requireAdmin(), listEvents(data))));

export const adminSessions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.extend({ q: z.string().optional() }).parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), listSessions(data))));

export const adminTerminateSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ sessionId: z.string() }).parse(data))
  .handler(async ({ data }) =>
    guard(() => (terminateWorkSession(requireAdmin(), data.sessionId), true)),
  );

export const adminWork = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) =>
    guard(() => (requireAdmin(), workSummary(data.from, data.to, data.app))),
  );

export const adminErp = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), erpSummary(data.from, data.to))));

export const adminCrm = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), crmSummary(data.from, data.to))));

export const adminSecurity = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), listSecurity(data.from, data.to))));

export const adminReviewSecurity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["open", "reviewing", "resolved"]),
        notes: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    guard(() => (reviewSecurity(requireAdmin(), data.id, data.status, data.notes), true)),
  );

export const adminAudit = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), listAudit(data.from, data.to))));

export const adminUsage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => rangeInput.parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), usageSplit(data.from, data.to))));

export const adminHealth = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => (requireAdmin(), systemHealth())),
);

export const adminSearch = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ q: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => guard(() => (requireAdmin(), searchCommandCenter(data.q))));

export const adminSettings = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => (requireAdmin(), getMonitorConfig())),
);

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heartbeatSeconds: z.number(),
        onlineMinutes: z.number(),
        idleMinutes: z.number(),
        retentionDays: z.number(),
        failedLoginThreshold: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => guard(() => saveMonitorConfig(requireAdmin(), data)));
