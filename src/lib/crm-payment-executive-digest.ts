/** Shared types and message formatting for executive overdue payment digests. */

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
  return `₹${value.toLocaleString("en-IN")}`;
}

function managerLabel(value?: string) {
  const trimmed = value?.trim();
  return trimmed || "—";
}

export function formatExecutiveDigestAccountLines(accounts: ExecutiveDigestAccountLine[]): string {
  return accounts
    .map((a, i) => {
      const overdueLabel =
        a.overdueDays != null && a.overdueDays > 0
          ? `${a.overdueDays} day(s) overdue`
          : "overdue";
      const due = a.dueDate?.slice(0, 10) ?? "—";
      return `${i + 1}. ${a.accountName}\n   Overdue: ${formatInr(a.overdueAmount)} (${overdueLabel}) · Due: ${due}\n   Pending: ${formatInr(a.pendingAmount)} · Received: ${formatInr(a.paymentReceived)} of ${formatInr(a.totalDealValue)}\n   Sales manager: ${managerLabel(a.salesManager)} · Support 1: ${managerLabel(a.supportManager1)} · Support 2: ${managerLabel(a.supportManager2)}`;
    })
    .join("\n\n");
}

export function buildExecutiveDigestTemplateVars(
  recipientName: string,
  accounts: ExecutiveDigestAccountLine[],
): Record<string, string> {
  const digestDetails = formatExecutiveDigestAccountLines(accounts);
  const primary = accounts[0];
  const accountCount = accounts.length;
  const subject = `Overdue payments digest — ${accountCount} account${accountCount === 1 ? "" : "s"}`;
  const body =
    accountCount === 0
      ? `Hi ${recipientName},\n\nNo overdue accounts in this digest.`
      : `Hi ${recipientName},\n\nThe following CRM account payments are overdue:\n\n${digestDetails}\n\nPlease follow up with clients and review details in CRM → Payments.`;

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
  return { subject: vars.subject!, body: vars.digestBody! };
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
