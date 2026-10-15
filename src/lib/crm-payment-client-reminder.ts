/** Client payment reminder preview (Payments → Remind client dialog). */
export type PaymentClientReminderPreview = {
  accountId: string;
  accountName: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  /** CC already applied from CRM Automation settings + rule (read-only). */
  defaultCc: string;
  ruleName: string;
};

export type PaymentClientReminderSendInput = {
  accountId: string;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
  extraCc?: string[];
};
