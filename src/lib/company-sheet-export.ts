import * as XLSX from "xlsx";

import { normalizeCompanyModules } from "@/data/module-catalog";
import { resolveAssigneeLabel } from "@/lib/managers";
import type { Company, Employee, StatusKey, User } from "@/types";
import { STATUS_LABEL } from "@/types";

export type CompanyExportRow = Company & {
  progress: number;
  computedStatus: StatusKey;
  isLive?: boolean;
};

export type CompanyExportContext = {
  users: User[];
  employees: Employee[];
  projectCountByCompanyId: Map<string, number>;
};

function exportDate(value?: string | null) {
  if (!value?.trim()) return "";
  return value.slice(0, 10);
}

function exportNumber(value?: number | null) {
  return value ?? "";
}

function exportModules(company: Company) {
  return normalizeCompanyModules(company.modules)
    .filter((m) => m.optedIn)
    .map((m) => m.label)
    .join(", ");
}

function companyToExportRow(company: CompanyExportRow, ctx: CompanyExportContext) {
  const { users, employees, projectCountByCompanyId } = ctx;
  return {
    "Company Name": company.name,
    "Contact Person": company.contact,
    Designation: company.designation,
    "Mobile Number": company.phone,
    Email: company.email,
    City: company.city,
    State: company.state ?? "",
    Region: company.region,
    "Company Type": company.companyType ?? "",
    "Owner Name": company.ownerName,
    "Owner Mobile": company.ownerMobile,
    "POC Name": company.pocName,
    "POC Mobile": company.pocMobile,
    "Office Address": company.officeAddress ?? "",
    "GST Number": company.gstNumber ?? "",
    "Billing Info": company.billingInfo ?? "",
    "Onboarding Manager": resolveAssigneeLabel(company.onboardingManagerId, users, employees),
    CSM: resolveAssigneeLabel(company.csmId, users, employees),
    "Sales Agent": resolveAssigneeLabel(company.salesAgentId, users, employees),
    "Support Manager 1": resolveAssigneeLabel(company.supportManager1Id, users, employees),
    "Support Manager 2": resolveAssigneeLabel(company.supportManager2Id, users, employees),
    Plan: company.plan,
    "Plan Name": company.planName ?? "",
    Health: company.health,
    "Onboarding Status": STATUS_LABEL[company.computedStatus] ?? company.computedStatus,
    Status: company.commercialStatus ?? "",
    "Progress %": company.progress,
    Live: company.isLive || company.progress >= 100 ? "Yes" : "No",
    Modules: exportModules(company),
    Projects: projectCountByCompanyId.get(company.id) ?? 0,
    "Agreement Date": exportDate(company.agreementDate),
    "Start date": exportDate(company.startDate || company.agreementDate),
    "End date/ Renewal date": exportDate(company.endDate),
    "Go-Live Target": exportDate(company.goLiveTarget),
    "Plan Expiry": exportDate(company.planExpiry),
    "Renewed At": exportDate(company.renewedAt),
    "Cancelled On": exportDate(company.cancelledOn),
    Quantity: exportNumber(company.usersPurchased),
    "Total Deal Value": exportNumber(company.dealSize),
    "Amount WITH GST": exportNumber(company.amountWithGst),
    Taxable: exportNumber(company.taxableAmount),
    GST: exportNumber(company.gstAmount),
    "Payment status": company.paymentStatus ?? "",
    "Installment amount": exportNumber(company.installmentAmount),
    "Due date": exportDate(company.installmentDueDate),
    "Total Cost": exportNumber(company.totalCost),
    "Payment Received": exportNumber(company.paymentReceived),
    "Pending Amount": exportNumber(company.pendingAmount),
    "Annual License": company.annualLicense === false ? "No" : "Yes",
  };
}

export const COMPANY_EXPORT_HEADERS = [
  "Company Name",
  "Contact Person",
  "Designation",
  "Mobile Number",
  "Email",
  "City",
  "State",
  "Region",
  "Company Type",
  "Owner Name",
  "Owner Mobile",
  "POC Name",
  "POC Mobile",
  "Office Address",
  "GST Number",
  "Billing Info",
  "Onboarding Manager",
  "CSM",
  "Sales Agent",
  "Support Manager 1",
  "Support Manager 2",
  "Plan",
  "Plan Name",
  "Health",
  "Onboarding Status",
  "Status",
  "Progress %",
  "Live",
  "Modules",
  "Projects",
  "Agreement Date",
  "Start date",
  "End date/ Renewal date",
  "Go-Live Target",
  "Plan Expiry",
  "Renewed At",
  "Cancelled On",
  "Quantity",
  "Total Deal Value",
  "Amount WITH GST",
  "Taxable",
  "GST",
  "Payment status",
  "Installment amount",
  "Due date",
  "Total Cost",
  "Payment Received",
  "Pending Amount",
  "Annual License",
] as const;

export function downloadCompaniesExport(
  companies: CompanyExportRow[],
  context: CompanyExportContext,
  filename?: string,
) {
  const rows = companies.map((c) => companyToExportRow(c, context));
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COMPANY_EXPORT_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Companies");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename ?? `companies_export_${stamp}.xlsx`);
}
