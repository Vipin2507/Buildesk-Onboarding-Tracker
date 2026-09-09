import * as XLSX from "xlsx";

import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import type { CrmAccountRow } from "@/stores/crm-dashboard-selectors";

export type CrmAccountExportColumnId =
  | "account"
  | "userId"
  | "city"
  | "state"
  | "region"
  | "country"
  | "companyType"
  | "modules"
  | "providers"
  | "usersPurchased"
  | "supportManager1"
  | "supportManager2"
  | "salesManagerName"
  | "accountManagerName"
  | "startDate"
  | "endDate"
  | "progress"
  | "stage"
  | "healthBucket"
  | "healthScore"
  | "status"
  | "overdue"
  | "contact"
  | "phone"
  | "email"
  | "pocName"
  | "pocMobile"
  | "pocEmail"
  | "ownerName"
  | "ownerPhone"
  | "dealSize"
  | "gstPercent"
  | "paymentReceived"
  | "pendingAmount"
  | "totalCost"
  | "valuePerUser"
  | "annualLicense"
  | "installmentCount"
  | "installments"
  | "portalApiKey"
  | "openTickets"
  | "openTasks"
  | "openQueries";

export type CrmAccountExportColumnDef = {
  id: CrmAccountExportColumnId;
  label: string;
  group: "Account" | "Location" | "Team" | "Onboarding" | "Commercial" | "Contact" | "Activity";
  defaultSelected?: boolean;
};

export const CRM_ACCOUNT_EXPORT_COLUMNS: CrmAccountExportColumnDef[] = [
  { id: "account", label: "Account", group: "Account", defaultSelected: true },
  { id: "userId", label: "User Id", group: "Account", defaultSelected: true },
  { id: "companyType", label: "Type", group: "Account", defaultSelected: true },
  { id: "status", label: "Status", group: "Account" },
  { id: "portalApiKey", label: "Portal API key", group: "Account" },
  { id: "city", label: "City", group: "Location", defaultSelected: true },
  { id: "state", label: "State", group: "Location" },
  { id: "region", label: "Region", group: "Location", defaultSelected: true },
  { id: "country", label: "Country", group: "Location" },
  { id: "modules", label: "Modules", group: "Onboarding", defaultSelected: true },
  { id: "providers", label: "Providers", group: "Onboarding" },
  { id: "usersPurchased", label: "Users", group: "Onboarding", defaultSelected: true },
  { id: "startDate", label: "Start", group: "Onboarding", defaultSelected: true },
  { id: "endDate", label: "End", group: "Onboarding", defaultSelected: true },
  { id: "progress", label: "Progress %", group: "Onboarding", defaultSelected: true },
  { id: "stage", label: "Stage", group: "Onboarding", defaultSelected: true },
  { id: "healthBucket", label: "Health", group: "Onboarding", defaultSelected: true },
  { id: "healthScore", label: "Health score", group: "Onboarding" },
  { id: "overdue", label: "Overdue", group: "Onboarding" },
  { id: "salesManagerName", label: "Sales Manager", group: "Team", defaultSelected: true },
  { id: "accountManagerName", label: "Account Manager", group: "Team" },
  { id: "supportManager1", label: "Support 1", group: "Team", defaultSelected: true },
  { id: "supportManager2", label: "Support 2", group: "Team", defaultSelected: true },
  { id: "contact", label: "Contact", group: "Contact" },
  { id: "phone", label: "Phone", group: "Contact" },
  { id: "email", label: "Email", group: "Contact" },
  { id: "pocName", label: "POC Name", group: "Contact" },
  { id: "pocMobile", label: "POC Mobile", group: "Contact" },
  { id: "pocEmail", label: "POC Email", group: "Contact" },
  { id: "ownerName", label: "Owner Name", group: "Contact" },
  { id: "ownerPhone", label: "Owner Phone", group: "Contact" },
  { id: "dealSize", label: "Deal incl. GST", group: "Commercial" },
  { id: "gstPercent", label: "GST %", group: "Commercial" },
  { id: "paymentReceived", label: "Payment Received", group: "Commercial" },
  { id: "pendingAmount", label: "Pending Amount", group: "Commercial" },
  { id: "totalCost", label: "Total Cost", group: "Commercial" },
  { id: "valuePerUser", label: "Value per user", group: "Commercial" },
  { id: "annualLicense", label: "Annual License", group: "Commercial" },
  { id: "installmentCount", label: "Installment count", group: "Commercial" },
  { id: "installments", label: "Installments", group: "Commercial" },
  { id: "openTickets", label: "Open tickets", group: "Activity" },
  { id: "openTasks", label: "Open tasks", group: "Activity" },
  { id: "openQueries", label: "Open queries", group: "Activity" },
];

export const CRM_ACCOUNT_EXPORT_DEFAULT_COLUMN_IDS = CRM_ACCOUNT_EXPORT_COLUMNS.filter(
  (c) => c.defaultSelected,
).map((c) => c.id);

export const CRM_ACCOUNT_TABLE_SEARCH_KEYS = [
  "name",
  "userId",
  "city",
  "contact",
  "email",
  "companyType",
  "salesManagerName",
  "supportManager1",
  "supportManager2",
] as const satisfies readonly (keyof CrmAccountRow)[];

export type CrmAccountExportContext = {
  portalSlugByCompanyId: Map<string, string | undefined>;
};

function exportDate(value?: string | null) {
  if (!value?.trim()) return "";
  return value.slice(0, 10);
}

function exportNumber(value?: number | null) {
  return value ?? "";
}

function formatInstallments(row: CrmAccountRow) {
  if (!row.installments?.length) return "";
  return row.installments
    .map((item, index) => `#${index + 1}: ${item.amount} due ${exportDate(item.dueDate)}`)
    .join("; ");
}

function columnValue(
  row: CrmAccountRow,
  columnId: CrmAccountExportColumnId,
  ctx: CrmAccountExportContext,
) {
  switch (columnId) {
    case "account":
      return row.name;
    case "userId":
      return row.userId?.trim() ?? "";
    case "city":
      return row.city ?? "";
    case "state":
      return row.state ?? "";
    case "region":
      return row.region ?? "";
    case "country":
      return row.country ?? "";
    case "companyType":
      return row.companyType;
    case "modules":
      return row.subscribedModules.map((m) => m.label).join(", ");
    case "providers":
      return row.providers.join(", ");
    case "usersPurchased":
      return exportNumber(row.usersPurchased);
    case "supportManager1":
      return row.supportManager1?.trim() ?? "";
    case "supportManager2":
      return row.supportManager2?.trim() ?? "";
    case "salesManagerName":
      return row.salesManagerName ?? "";
    case "accountManagerName":
      return row.accountManagerName ?? "";
    case "startDate":
      return exportDate(row.startDate);
    case "endDate":
      return exportDate(row.endDate);
    case "progress":
      return row.progress;
    case "stage":
      return row.stageLabel;
    case "healthBucket":
      return row.healthBucket;
    case "healthScore":
      return row.resolvedHealth;
    case "status":
      return crmAccountStatusLabel(row.status);
    case "overdue":
      return row.overdue ? "Yes" : "No";
    case "contact":
      return row.contact ?? "";
    case "phone":
      return row.phone ?? "";
    case "email":
      return row.email ?? "";
    case "pocName":
      return row.pocName ?? "";
    case "pocMobile":
      return row.pocMobile ?? "";
    case "pocEmail":
      return row.pocEmail ?? "";
    case "ownerName":
      return row.ownerName ?? "";
    case "ownerPhone":
      return row.ownerPhone ?? "";
    case "dealSize":
      return exportNumber(row.dealSize);
    case "gstPercent":
      return exportNumber(row.gstPercent);
    case "paymentReceived":
      return exportNumber(row.paymentReceived);
    case "pendingAmount":
      return exportNumber(row.pendingAmount);
    case "totalCost":
      return exportNumber(row.totalCost);
    case "valuePerUser":
      return exportNumber(row.valuePerUser);
    case "annualLicense":
      return row.annualLicense === false ? "No" : row.annualLicense ? "Yes" : "";
    case "installmentCount":
      return exportNumber(row.installmentCount);
    case "installments":
      return formatInstallments(row);
    case "portalApiKey":
      return ctx.portalSlugByCompanyId.get(row.id) ?? "";
    case "openTickets":
      return row.openTickets;
    case "openTasks":
      return row.openTasks;
    case "openQueries":
      return row.openQueries;
    default:
      return "";
  }
}

export function filterCrmAccountsForTableSearch(
  rows: CrmAccountRow[],
  query: string,
): CrmAccountRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    CRM_ACCOUNT_TABLE_SEARCH_KEYS.some((key) =>
      String(row[key] ?? "")
        .toLowerCase()
        .includes(q),
    ),
  );
}

export function downloadCrmAccountsExport(
  rows: CrmAccountRow[],
  selectedColumnIds: CrmAccountExportColumnId[],
  context: CrmAccountExportContext,
  filename?: string,
) {
  const columns = CRM_ACCOUNT_EXPORT_COLUMNS.filter((c) => selectedColumnIds.includes(c.id));
  if (!columns.length) {
    throw new Error("Select at least one column to export.");
  }

  const headers = columns.map((c) => c.label);
  const sheetRows = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      out[col.label] = columnValue(row, col.id, context);
    }
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CRM Accounts");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename ?? `crm_accounts_export_${stamp}.xlsx`);
}
