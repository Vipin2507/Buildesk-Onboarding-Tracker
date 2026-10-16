import type { ErpCompanyPaymentListItem } from "@/types/company-payment";

function csvEscape(value: string | number | undefined | null) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildErpPaymentsCsv(rows: ErpCompanyPaymentListItem[]): string {
  const headers = [
    "Company",
    "City",
    "Subscription",
    "Deal",
    "Received",
    "Pending",
    "Collection %",
    "Payment status",
    "Next due date",
    "Next due amount",
    "Overdue amount",
    "Ledger count",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.companyName),
        csvEscape(r.city),
        csvEscape(r.commercialStatus),
        csvEscape(r.dealSize),
        csvEscape(r.paymentReceived),
        csvEscape(r.pendingAmount),
        csvEscape(r.collectionPercent),
        csvEscape(r.paymentStatus),
        csvEscape(r.nextDueDate),
        csvEscape(r.nextDueAmount),
        csvEscape(r.overdueAmount),
        csvEscape(r.transactionCount),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadErpPaymentsCsv(rows: ErpCompanyPaymentListItem[], filename?: string) {
  const csv = buildErpPaymentsCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ?? `erp-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
