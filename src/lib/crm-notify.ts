import { CRM_STAGE_LABELS } from "@/data/crm-onboarding-defaults";
import type { CrmImplementationStage } from "@/types/crm-onboarding";
import { notifyInApp } from "@/stores/useNotificationStore";

function accountHref(companyId: string) {
  return `/crm/accounts/${companyId}`;
}

export function notifyCrmStageChange(
  companyId: string,
  accountName: string,
  stage: CrmImplementationStage,
  who?: string,
) {
  const stageLabel = CRM_STAGE_LABELS[stage] ?? stage;
  return notifyInApp({
    title: `${accountName} → ${stageLabel}`,
    body: who ? `Stage updated by ${who}` : "Implementation stage changed",
    kind: "info",
    href: accountHref(companyId),
    companyId,
    gate: "crmStage",
  });
}

export function notifyCrmTrainingLogged(
  companyId: string,
  accountName: string,
  sessionLabel: string,
) {
  return notifyInApp({
    title: `Training logged · ${accountName}`,
    body: sessionLabel,
    kind: "success",
    href: accountHref(companyId),
    companyId,
    gate: "crmTraining",
  });
}

export function notifyCrmGoLive(companyId: string, accountName: string, who?: string) {
  return notifyInApp({
    title: `${accountName} is live`,
    body: who ? `Marked live by ${who}` : "Account go-live completed",
    kind: "success",
    href: accountHref(companyId),
    companyId,
    gate: "crmGoLive",
  });
}
