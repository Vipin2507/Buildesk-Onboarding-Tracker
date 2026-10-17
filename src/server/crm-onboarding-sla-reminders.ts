import { and, eq } from "drizzle-orm";

import { calcCrmOnboardingProgress } from "@/data/crm-onboarding-defaults";
import { absoluteAppUrl } from "@/lib/app-base-url";
import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import {
  daysSinceOnboardingStart,
  isOnboardingBehindTarget,
  onboardingTargetBucketLabel,
  resolveOnboardingTargetBucket,
  todayYmd,
} from "@/lib/crm-onboarding-sla";
import { isCrmGoLiveStage } from "@/lib/crm-implementation-stages";
import { normalizeCrmOnboardingTargetSettings } from "@/data/crm-onboarding-targets-seed";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { PAYMENT_AUTOMATION_SEND_PAUSE_MS } from "@/server/crm-payment-reminder-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { resolveOnboardingSlaRecipients } from "@/server/lib/crm-executive-recipients";
import { renderAutomationTemplate } from "@/services/automationTemplate";
import { newId, nowIso } from "@/types";
import type { CrmOnboardingRecord } from "@/types/crm-onboarding";
import type { CrmOnboardingTargetSettings } from "@/types/crm-master";
import type { AutomationLog, AutomationRule, WahaConfig } from "@/types/automation";

type Db = ReturnType<typeof getDb>;

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `SLA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function pauseBetweenSends() {
  return new Promise<void>((resolve) => setTimeout(resolve, PAYMENT_AUTOMATION_SEND_PAUSE_MS));
}

export function loadCrmOnboardingTargets(db: Db): CrmOnboardingTargetSettings {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-master")).get();
  if (!row?.valueJson) return normalizeCrmOnboardingTargetSettings(null);
  try {
    const parsed = JSON.parse(row.valueJson) as { onboardingTargets?: unknown };
    return normalizeCrmOnboardingTargetSettings(parsed.onboardingTargets);
  } catch {
    return normalizeCrmOnboardingTargetSettings(null);
  }
}

function parseOnboardingPayload(raw: string | null | undefined): CrmOnboardingRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrmOnboardingRecord;
  } catch {
    return null;
  }
}

function slaAlreadySent(
  db: Db,
  accountId: string,
  ruleId: string,
  bucketId: string,
): boolean {
  const row = db
    .select({ id: t.automationRemindersSent.id })
    .from(t.automationRemindersSent)
    .where(
      and(
        eq(t.automationRemindersSent.taskId, accountId),
        eq(t.automationRemindersSent.ruleId, ruleId),
        eq(t.automationRemindersSent.assigneeUserId, "onboarding-sla"),
        eq(t.automationRemindersSent.startsAt, bucketId),
      ),
    )
    .get();
  return Boolean(row);
}

function recordSlaSent(db: Db, accountId: string, ruleId: string, bucketId: string) {
  db.insert(t.automationRemindersSent)
    .values({
      id: newId(),
      taskId: accountId,
      ruleId,
      assigneeUserId: "onboarding-sla",
      startsAt: bucketId,
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

async function dispatchOnboardingSlaWhatsapp(
  db: Db,
  config: ReturnType<typeof loadCrmAutomationConfig>,
  rule: AutomationRule,
  opts: {
    account: typeof t.crmAccounts.$inferSelect;
    recipient: { id: string; name: string; phone?: string };
    vars: Record<string, string>;
  },
): Promise<boolean> {
  const message = renderAutomationTemplate(rule.templateBody, opts.vars);
  const attemptedAt = nowIso();
  const baseLog: AutomationLog = {
    id: serverLogId(),
    companyId: opts.account.id,
    channel: "whatsapp",
    trigger: "onboarding-sla-remind",
    status: "retrying",
    requestPayload: {
      accountId: opts.account.id,
      ruleId: rule.id,
      recipientUserId: opts.recipient.id,
      bucketId: opts.vars.targetLabel,
    },
    attemptedAt,
    retryCount: 0,
  };

  const wahaEndpoint = config.endpoints.find((e) => e.channel === "whatsapp" && e.isEnabled);
  if (!wahaEndpoint || !config.waha.isEnabled) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "WhatsApp endpoint disabled",
    });
    return false;
  }

  const chatId = phoneToWahaChatId(opts.recipient.phone);
  if (!chatId) {
    appendServerCrmAutomationLog(db, {
      ...baseLog,
      status: "failed",
      errorMessage: "Recipient has no valid phone for WhatsApp",
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

/**
 * WhatsApp Support 1/2 + Admins when overall onboarding % is below Master day-bucket targets.
 * Dedupe: once per account × rule × bucket (via automation_reminders_sent).
 */
export async function processCrmOnboardingSlaReminders(db: Db): Promise<number> {
  const config = loadCrmAutomationConfig(db);
  if (!config.settings.automationsEnabled) return 0;

  const rules = config.rules.filter(
    (r) => r.isActive && r.trigger === "onboarding-sla-remind" && r.channel === "whatsapp",
  );
  if (rules.length === 0) return 0;

  const targets = loadCrmOnboardingTargets(db);
  if (!targets.buckets.some((b) => b.active)) return 0;

  const today = todayYmd();
  const accounts = db.select().from(t.crmAccounts).all();
  let sentCount = 0;

  for (const account of accounts) {
    const status = (account.status || "").toLowerCase();
    if (status === "live" || status === "closed" || status === "inactive" || status === "suspended") {
      continue;
    }

    const days = daysSinceOnboardingStart(
      { startDate: account.startDate, createdAt: account.createdAt },
      today,
    );
    if (days == null || days < 0 || days > targets.targetDays) continue;

    const bucket = resolveOnboardingTargetBucket(targets, days);
    if (!bucket) continue;

    const onboardingRow = db
      .select()
      .from(t.crmOnboardingRecords)
      .where(eq(t.crmOnboardingRecords.companyId, account.id))
      .get();
    const record = parseOnboardingPayload(onboardingRow?.payloadJson);
    if (!record) continue;
    if (isCrmGoLiveStage(record.tracker?.stage)) continue;

    const progress = calcCrmOnboardingProgress(record);
    if (!isOnboardingBehindTarget(progress, bucket)) continue;

    const recipients = resolveOnboardingSlaRecipients(db, account);
    if (recipients.length === 0) continue;

    const varsBase: Record<string, string> = {
      accountName: account.name,
      companyName: account.name,
      customerName: account.pocName || account.contact || account.name,
      daysSinceStart: String(days),
      targetDays: String(targets.targetDays),
      targetLabel: onboardingTargetBucketLabel(bucket),
      currentProgress: String(progress),
      targetProgress: String(bucket.minProgressPercent),
      targetRemarks: bucket.remarks,
      supportManager1: account.supportManager1?.trim() || "—",
      supportManager2: account.supportManager2?.trim() || "—",
      salesManagerName: account.salesManagerName?.trim() || "—",
      onboardingUrl: absoluteAppUrl(`/crm/accounts/${account.id}`),
      status: account.status,
    };

    for (const rule of rules) {
      if (slaAlreadySent(db, account.id, rule.id, bucket.id)) continue;

      let anyOk = false;
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]!;
        if (i > 0) await pauseBetweenSends();
        const ok = await dispatchOnboardingSlaWhatsapp(db, config, rule, {
          account,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            phone: recipient.phone,
          },
          vars: { ...varsBase, recipientName: recipient.name },
        });
        if (ok) {
          anyOk = true;
          sentCount += 1;
        }
      }
      if (anyOk) {
        recordSlaSent(db, account.id, rule.id, bucket.id);
      }
    }
  }

  return sentCount;
}
