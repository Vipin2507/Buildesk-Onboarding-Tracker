import { and, eq, inArray } from "drizzle-orm";

import { DEFAULT_TASK_REMINDER_OFFSET_MINUTES } from "@/data/crm-automation-defaults";
import { N8N_EMAIL_SEGMENT } from "@/data/crm-automation-defaults";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import { localWallClockIso } from "@/lib/booking-slots";
import { subtractWallClockMinutes } from "@/lib/task-scheduling";
import { resolveUserWorkEmail } from "@/lib/user-email";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { mapTaskRow, parseAssigneeIdsJson } from "@/server/lib/task-schedule";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { newId, nowIso } from "@/types";
import type { AutomationLog, AutomationRule, WahaConfig } from "@/types/automation";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";
import type { FollowUpTask } from "@/types";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

function serverLogId() {
  return `CAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function formatTaskWhen(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function mergeEmailCc(globalCc?: string, ruleCc?: string): string {
  const parts = [globalCc, ruleCc].flatMap((value) =>
    value
      ? value
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  return [...new Set(parts)].join(", ");
}

function taskAssigneeIds(row: typeof t.followUpTasks.$inferSelect): string[] {
  const fromJson = parseAssigneeIdsJson(row.assigneeUserIdsJson);
  if (fromJson.length) return fromJson;
  return row.assigneeUserId ? [row.assigneeUserId] : [];
}

function reminderAlreadySent(
  db: ReturnType<typeof getDb>,
  taskId: string,
  ruleId: string,
  assigneeUserId: string,
  startsAt: string,
): boolean {
  const row = db
    .select({ id: t.automationRemindersSent.id })
    .from(t.automationRemindersSent)
    .where(
      and(
        eq(t.automationRemindersSent.taskId, taskId),
        eq(t.automationRemindersSent.ruleId, ruleId),
        eq(t.automationRemindersSent.assigneeUserId, assigneeUserId),
        eq(t.automationRemindersSent.startsAt, startsAt),
      ),
    )
    .get();
  return Boolean(row);
}

function recordReminderSent(
  db: ReturnType<typeof getDb>,
  taskId: string,
  ruleId: string,
  assigneeUserId: string,
  startsAt: string,
) {
  db.insert(t.automationRemindersSent)
    .values({
      id: newId(),
      taskId,
      ruleId,
      assigneeUserId,
      startsAt,
      sentAt: nowIso(),
    })
    .run();
}

async function sendServerWahaText(waha: WahaConfig, chatId: string, text: string) {
  const res = await fetch(`${trimSlash(waha.apiUrl)}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": waha.apiKey,
    },
    body: JSON.stringify({
      session: waha.sessionName,
      chatId,
      text,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, text: body };
}

function buildTaskReminderVars(input: {
  task: FollowUpTask;
  assigneeName: string;
  accountName: string;
  offsetMinutes: number;
  taskUrl: string;
}): Record<string, string> {
  const startsAt = input.task.startsAt?.slice(0, 19) ?? "";
  const endsAt = input.task.endsAt?.slice(0, 19) ?? "";
  return {
    customerName: input.assigneeName,
    assigneeName: input.assigneeName,
    accountName: input.accountName,
    companyName: input.accountName,
    taskId: input.task.id,
    taskTitle: input.task.title,
    title: input.task.title,
    subject: input.task.title,
    taskUrl: input.taskUrl,
    ticketUrl: input.taskUrl,
    ticketNumber: input.task.id,
    startsAt: startsAt ? formatTaskWhen(startsAt) : "",
    endsAt: endsAt ? formatTaskWhen(endsAt) : "",
    offsetMinutes: String(input.offsetMinutes),
    status: input.task.status.replace(/_/g, " "),
  };
}

async function dispatchTaskReminderForRule(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  task: FollowUpTask,
  assignee: { id: string; name: string; phone?: string | null },
  accountName: string,
  startsAt: string,
  offsetMinutes: number,
): Promise<boolean> {
  const taskUrl = `/crm/tasks?task=${task.id}`;
  const vars = buildTaskReminderVars({
    task,
    assigneeName: assignee.name,
    accountName,
    offsetMinutes,
    taskUrl,
  });
  const message = renderAutomationTemplate(rule.templateBody, vars);
  const subject = renderAutomationSubject(rule.templateSubject, vars);
  const assigneeUser = db.select().from(t.users).where(eq(t.users.id, assignee.id)).get();
  const recipientEmail = resolveUserWorkEmail(assigneeUser ?? undefined);
  const recipientPhone = assigneeUser?.phone ?? assignee.phone ?? undefined;

  const attemptedAt = nowIso();
  const logId = serverLogId();
  const baseLog: AutomationLog = {
    id: logId,
    ticketNumber: task.id,
    companyId: task.companyId,
    channel: rule.channel,
    trigger: "task-before-start",
    status: "retrying",
    requestPayload: {
      taskId: task.id,
      ruleId: rule.id,
      assigneeUserId: assignee.id,
      offsetMinutes,
    },
    attemptedAt,
    retryCount: 0,
  };

  if (rule.channel === "email") {
    const emailEndpoint = config.endpoints.find((e) => e.channel === "email" && e.isEnabled);
    if (!emailEndpoint || !recipientEmail?.trim()) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: recipientEmail ? "Email endpoint disabled" : "Assignee has no email",
      });
      return false;
    }

    const n8nBase = config.settings.n8nWebhookBase;
    const url = buildN8nUrl(n8nBase, N8N_EMAIL_SEGMENT);
    const body = {
      channel: "email" as const,
      templateId: rule.id,
      templateName: rule.name,
      trigger: "task-before-start",
      recipientEmail,
      recipientName: assignee.name,
      messageBody: message,
      emailSubject: subject,
      emailCc: mergeEmailCc(config.settings.emailCc, rule.emailCc),
      entityType: "crm-task",
      productScope: "crm",
      entityId: task.id,
      entityName: task.title,
      companyName: accountName,
      customerName: assignee.name,
      customerEmail: recipientEmail,
      taskId: task.id,
      taskTitle: task.title,
      taskUrl,
      startsAt: vars.startsAt,
      endsAt: vars.endsAt,
      offsetMinutes,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: `HTTP ${res.status}: ${summarizeResponse(text, 240)}`,
          responseSummary: summarizeResponse(text),
          requestPayload: body as unknown as Record<string, unknown>,
        });
        return false;
      }
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "success",
        responseSummary: summarizeResponse(text),
        requestPayload: body as unknown as Record<string, unknown>,
      });
      return true;
    } catch (err) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Network error",
      });
      return false;
    }
  }

  const wahaEndpoint = config.endpoints.find((e) => e.channel === "whatsapp" && e.isEnabled);
  if (!wahaEndpoint || !config.waha.isEnabled) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "WhatsApp endpoint disabled",
    });
    return false;
  }

  const chatId = phoneToWahaChatId(recipientPhone ?? undefined);
  if (!chatId) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "Assignee has no valid phone for WhatsApp",
    });
    return false;
  }

  try {
    const res = await sendServerWahaText(config.waha, chatId, message);
    if (!res.ok) {
      appendServerCrmAutomationLog(db, {
        ...baseLog,
        status: "failed",
        errorMessage: `HTTP ${res.status}: ${summarizeResponse(res.text, 240)}`,
        responseSummary: summarizeResponse(res.text),
        requestPayload: { chatId, message },
      });
      return false;
    }
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "success",
      responseSummary: summarizeResponse(res.text),
      requestPayload: { chatId, message },
    });
    return true;
  } catch (err) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Network error",
    });
    return false;
  }
}

/** Send email/WhatsApp reminders for scheduled tasks approaching their start time. */
export async function processTaskReminderAutomations(
  db: ReturnType<typeof getDb>,
  timezone = DEFAULT_BOOKING_TIMEZONE,
): Promise<number> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return 0;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "task-before-start",
  );
  if (rules.length === 0) return 0;

  const nowWall = localWallClockIso(timezone);
  const now = nowWall.slice(0, 19);

  const taskRows = db
    .select()
    .from(t.followUpTasks)
    .where(inArray(t.followUpTasks.status, ["open", "in_progress", "blocked"]))
    .all()
    .filter((row) => row.productScope === "crm" && row.startsAt);

  let sentCount = 0;

  for (const row of taskRows) {
    const task = mapTaskRow(row);
    const startsAt = task.startsAt!.slice(0, 19);
    if (now >= startsAt) continue;

    const account =
      db.select({ name: t.crmAccounts.name }).from(t.crmAccounts).where(eq(t.crmAccounts.id, task.companyId)).get() ??
      db.select({ name: t.companies.name }).from(t.companies).where(eq(t.companies.id, task.companyId)).get();
    const accountName = account?.name ?? "CRM account";

    const assigneeIds = taskAssigneeIds(row);
    if (assigneeIds.length === 0) continue;

    for (const rule of rules) {
      const offsetMinutes = rule.offsetMinutes ?? DEFAULT_TASK_REMINDER_OFFSET_MINUTES;
      if (offsetMinutes <= 0) continue;

      const reminderAt = subtractWallClockMinutes(startsAt, offsetMinutes);
      if (now < reminderAt) continue;

      for (const assigneeId of assigneeIds) {
        if (reminderAlreadySent(db, task.id, rule.id, assigneeId, startsAt)) continue;

        const assignee = db.select().from(t.users).where(eq(t.users.id, assigneeId)).get();
        if (!assignee || assignee.active === false) continue;

        const ok = await dispatchTaskReminderForRule(
          db,
          config,
          rule,
          task,
          { id: assignee.id, name: assignee.name, phone: assignee.phone },
          accountName,
          startsAt,
          offsetMinutes,
        );
        if (ok) {
          recordReminderSent(db, task.id, rule.id, assigneeId, startsAt);
          sentCount += 1;
        }
      }
    }
  }

  return sentCount;
}
