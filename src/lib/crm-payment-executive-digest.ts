/** Shared types and message formatting for executive overdue payment digests. */

import { formatDate } from "@/lib/utils";

export type ExecutiveDigestAccountLine = {
  accountId: string;
  accountName: string;
  overdueAmount: number;
  overdueDays: number | null;
  dueDate: string | null;
  pendingAmount: number;
  paymentReceived: number;
  totalDealValue: number;
  salesManager?: string;
  supportManager1?: string;
  supportManager2?: string;
};

export type ExecutiveDigestRecipientPreview = {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  accountIds: string[];
};

export type ExecutiveOverdueDigestPreview = {
  accounts: ExecutiveDigestAccountLine[];
  recipients: ExecutiveDigestRecipientPreview[];
};

export type ExecutiveDigestDelivery = {
  recipientUserId: string;
  accountIds: string[];
};

function formatInr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatSupportNames(a: ExecutiveDigestAccountLine): string {
  const names = [a.supportManager1, a.supportManager2]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  return names.length > 0 ? names.join(", ") : "—";
}

function formatOverdueDaysLabel(days: number | null): string {
  if (days == null || days <= 0) return "overdue";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** WhatsApp: *bold* */
function waBold(text: string) {
  return `*${text}*`;
}

/** WhatsApp: _italic_ */
function waItalic(text: string) {
  return `_${text}_`;
}

export function formatExecutiveDigestAccountBlock(
  a: ExecutiveDigestAccountLine,
  index: number,
): string {
  return [
    `${index + 1}. ${a.accountName}`,
    `🔴 Overdue: ${formatInr(a.overdueAmount)} (${formatOverdueDaysLabel(a.overdueDays)})`,
    `📅 Due: ${formatDate(a.dueDate)}`,
    `💰 Pending: ${formatInr(a.pendingAmount)}`,
    `✅ Received: ${formatInr(a.paymentReceived)} / ${formatInr(a.totalDealValue)}`,
    `👤 Support: ${formatSupportNames(a)}`,
  ].join("\n");
}

export function formatExecutiveDigestAccountBlockWhatsapp(
  a: ExecutiveDigestAccountLine,
  index: number,
): string {
  return [
    `${index + 1}. ${waBold(a.accountName)}`,
    `🔴 ${waBold("Overdue:")} ${formatInr(a.overdueAmount)} (${formatOverdueDaysLabel(a.overdueDays)})`,
    `📅 ${waBold("Due:")} ${formatDate(a.dueDate)}`,
    `💰 ${waBold("Pending:")} ${formatInr(a.pendingAmount)}`,
    `✅ ${waBold("Received:")} ${formatInr(a.paymentReceived)} / ${formatInr(a.totalDealValue)}`,
    `👤 ${waBold("Support:")} ${formatSupportNames(a)}`,
  ].join("\n");
}

export function formatExecutiveDigestAccountLines(accounts: ExecutiveDigestAccountLine[]): string {
  return accounts
    .map((a, i) => formatExecutiveDigestAccountBlock(a, i))
    .join("\n\n");
}

function formatExecutiveDigestAccountLinesWhatsapp(accounts: ExecutiveDigestAccountLine[]): string {
  return accounts
    .map((a, i) => formatExecutiveDigestAccountBlockWhatsapp(a, i))
    .join("\n\n");
}

export function sumExecutiveDigestOverdue(accounts: ExecutiveDigestAccountLine[]): number {
  return accounts.reduce((sum, a) => sum + (a.overdueAmount > 0 ? a.overdueAmount : 0), 0);
}

export function buildExecutiveDigestTemplateVars(
  recipientName: string,
  accounts: ExecutiveDigestAccountLine[],
): Record<string, string> {
  const digestDetails = formatExecutiveDigestAccountLines(accounts);
  const digestDetailsWhatsapp = formatExecutiveDigestAccountLinesWhatsapp(accounts);
  const totalOutstanding = sumExecutiveDigestOverdue(accounts);
  const primary = accounts[0];
  const accountCount = accounts.length;
  const accountLabel = accountCount === 1 ? "1 ACCOUNT" : `${accountCount} ACCOUNTS`;
  const subject = `Payment reminder — ${accountCount} account${accountCount === 1 ? "" : "s"}`;
  const body =
    accountCount === 0
      ? `Hi ${recipientName},\n\nNo overdue accounts in this digest.`
      : [
          `Hi ${recipientName},`,
          "",
          `🔔 PAYMENT REMINDER — ${accountLabel}`,
          "",
          "Please find below the accounts with overdue payments:",
          "",
          digestDetails,
          "",
          `📌 TOTAL OUTSTANDING: ${formatInr(totalOutstanding)}`,
          "",
          "Request you to please review these accounts and ensure the necessary payment follow-up and closure.",
          "",
          "🔗 CRM → Payments",
        ].join("\n");

  const bodyWhatsapp =
    accountCount === 0
      ? `Hi ${waBold(recipientName)},\n\nNo overdue accounts in this digest.`
      : [
          `Hi ${waBold(recipientName)},`,
          "",
          waBold(`🔔 PAYMENT REMINDER — ${accountLabel}`),
          "",
          waItalic("Please find below the accounts with overdue payments:"),
          "",
          digestDetailsWhatsapp,
          "",
          `📌 ${waBold(`TOTAL OUTSTANDING: ${formatInr(totalOutstanding)}`)}`,
          "",
          waItalic(
            "Request you to please review these accounts and ensure the necessary payment follow-up and closure.",
          ),
          "",
          waBold("🔗 CRM → Payments"),
        ].join("\n");

  return {
    executiveName: recipientName,
    assigneeName: recipientName,
    customerName: recipientName,
    recipientName,
    accountCount: String(accountCount),
    accountName: primary?.accountName ?? (accountCount > 1 ? `${accountCount} accounts` : "—"),
    companyName: primary?.accountName ?? "CRM Payments",
    digestDetails,
    digestBody: body,
    digestBodyWhatsapp: bodyWhatsapp,
    totalOutstanding: String(Math.round(totalOutstanding)),
    subject,
    title: subject,
    status: "overdue",
    dueAmount: primary ? String(primary.overdueAmount) : "0",
    dueDate: primary?.dueDate?.slice(0, 10) ?? "—",
    paymentReceived: primary ? String(primary.paymentReceived) : "0",
    pendingAmount: primary ? String(primary.pendingAmount) : "0",
    totalDealValue: primary ? String(primary.totalDealValue) : "0",
    overdueAmount: primary ? String(primary.overdueAmount) : "0",
    overdueDays: primary?.overdueDays != null ? String(primary.overdueDays) : "0",
    salesManagerName: primary?.salesManager?.trim() || "—",
    supportManager1: primary?.supportManager1?.trim() || "—",
    supportManager2: primary?.supportManager2?.trim() || "—",
  };
}

export function formatExecutivePaymentDigestMessage(
  recipientName: string,
  accounts: ExecutiveDigestAccountLine[],
): { subject: string; body: string } {
  const vars = buildExecutiveDigestTemplateVars(recipientName, accounts);
  return { subject: vars.subject!, body: vars.digestBodyWhatsapp! };
}

export function buildDeliveriesFromSelection(input: {
  recipients: ExecutiveDigestRecipientPreview[];
  selectedRecipientIds: Set<string>;
  selectedAccountIds: Set<string>;
}): ExecutiveDigestDelivery[] {
  const deliveries: ExecutiveDigestDelivery[] = [];
  for (const recipient of input.recipients) {
    if (!input.selectedRecipientIds.has(recipient.userId)) continue;
    const accountIds = recipient.accountIds.filter((id) => input.selectedAccountIds.has(id));
    if (accountIds.length === 0) continue;
    deliveries.push({ recipientUserId: recipient.userId, accountIds });
  }
  return deliveries;
}
