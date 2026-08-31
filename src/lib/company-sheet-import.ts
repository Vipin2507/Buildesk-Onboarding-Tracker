import * as XLSX from "xlsx";

import { roundMoney } from "@/lib/crm-account-commercial";
import { normalizeImportDate } from "@/lib/project-sheet-import";
import type {
  Company,
  CompanyCommercialPlanName,
  CompanyCommercialStatus,
  CompanyPaymentStatus,
  CompanyPlan,
} from "@/types/company";
import {
  COMPANY_COMMERCIAL_PLAN_NAMES,
  COMPANY_COMMERCIAL_STATUSES,
  COMPANY_PAYMENT_STATUSES,
} from "@/types/company";

/** Headers from the commercial ERP company bulk-update sheet. */
export const COMPANY_COMMERCIAL_IMPORT_HEADERS = [
  "Status",
  "Name",
  "Quantity",
  "Total Deal Value",
  "Amount WITH GST",
  "Taxable",
  "GST",
  "Plan Name",
  "Payment status",
  "Installment/Pending payment",
  "Start date",
  "End date/ Renewal date",
  "Cancelled On",
] as const;

export type CompanyCommercialImportHeader = (typeof COMPANY_COMMERCIAL_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<CompanyCommercialImportHeader, string[]> = {
  Status: ["status", "accountstatus", "subscriptionstatus"],
  Name: ["name", "companyname", "company", "clientname", "client"],
  Quantity: ["quantity", "users", "userspurchased", "qty", "seats", "licences", "licenses"],
  "Total Deal Value": ["totaldealvalue", "dealvalue", "dealsize", "totalvalue"],
  "Amount WITH GST": ["amountwithgst", "totalwithgst", "amountwithtax", "grandtotal"],
  Taxable: ["taxable", "taxableamount", "taxablevalue"],
  GST: ["gst", "gstamount", "taxamount", "tax"],
  "Plan Name": ["planname", "plan", "subscriptionplan"],
  "Payment status": ["paymentstatus", "payment", "paidstatus"],
  "Installment/Pending payment": [
    "installmentpendingpayment",
    "installment",
    "pendingpayment",
    "pendingamount",
    "pending",
    "installmentcount",
  ],
  "Start date": ["startdate", "start", "fromdate", "contractstart"],
  "End date/ Renewal date": [
    "enddaterenewaldate",
    "enddate",
    "renewaldate",
    "expirydate",
    "expiry",
    "renewal",
  ],
  "Cancelled On": ["cancelledon", "canceldate", "cancellationdate", "cancelleddate"],
};

export type CompanyCommercialImportRawRow = {
  rowNumber: number;
  statusRaw: string;
  name: string;
  quantityRaw: string;
  totalDealValueRaw: string;
  amountWithGstRaw: string;
  taxableRaw: string;
  gstRaw: string;
  planNameRaw: string;
  paymentStatusRaw: string;
  installmentPendingRaw: string;
  startDateRaw: string;
  endDateRaw: string;
  cancelledOnRaw: string;
  quantity: number | null;
  totalDealValue: number | null;
  amountWithGst: number | null;
  taxableAmount: number | null;
  gstAmount: number | null;
  pendingAmount: number | null;
  installmentCount: number | null;
  startDate: string | null;
  endDate: string | null;
  cancelledOn: string | null;
  commercialStatus: CompanyCommercialStatus | null;
  planName: CompanyCommercialPlanName | null;
  paymentStatus: CompanyPaymentStatus | null;
  parseErrors: string[];
};

export type CompanyCommercialImportPlanRow = {
  rowNumber: number;
  name: string;
  commercialStatus: CompanyCommercialStatus | null;
  planName: CompanyCommercialPlanName | null;
  plan: CompanyPlan | null;
  usersPurchased: number | null;
  dealSize: number | null;
  totalCost: number | null;
  amountWithGst: number | null;
  taxableAmount: number | null;
  gstAmount: number | null;
  paymentStatus: CompanyPaymentStatus | null;
  pendingAmount: number | null;
  paymentReceived: number | null;
  installmentCount: number | null;
  startDate: string | null;
  endDate: string | null;
  planExpiry: string | null;
  renewedAt: string | null;
  cancelledOn: string | null;
  action: "update" | "skip" | "error";
  existingId?: string;
  existingName?: string;
  message: string;
};

export type CompanyCommercialImportPlan = {
  rows: CompanyCommercialImportPlanRow[];
  summary: {
    update: number;
    skip: number;
    notFound: number;
    error: number;
    ambiguous: number;
  };
};

export type CompanyCommercialPatch = Partial<
  Pick<
    Company,
    | "status"
    | "plan"
    | "planName"
    | "usersPurchased"
    | "dealSize"
    | "totalCost"
    | "paymentReceived"
    | "pendingAmount"
    | "startDate"
    | "endDate"
    | "planExpiry"
    | "renewedAt"
    | "amountWithGst"
    | "taxableAmount"
    | "gstAmount"
    | "paymentStatus"
    | "commercialStatus"
    | "installmentCount"
    | "cancelledOn"
  >
>;

function normKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./]+/g, "");
}

export function normalizeCompanyName(value: string) {
  return value
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).replace(/[^\d.-]/g, "").trim();
  if (!raw || raw === "-" || raw === ".") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapHeaders(keys: string[]) {
  const mapped: Partial<Record<CompanyCommercialImportHeader, string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of COMPANY_COMMERCIAL_IMPORT_HEADERS) {
    const aliases = new Set([normKey(header), ...HEADER_ALIASES[header]]);
    const hit = normalized.find((k) => aliases.has(k.key));
    if (hit) mapped[header] = hit.raw;
  }

  return mapped;
}

function enumLookup<T extends string>(values: readonly T[], raw: string): T | null {
  const key = normKey(raw);
  if (!key) return null;
  for (const value of values) {
    if (normKey(value) === key) return value;
  }
  return null;
}

const COMMERCIAL_STATUS_ALIASES: Record<string, CompanyCommercialStatus> = {
  cancelled: "Canceled",
  cancel: "Canceled",
};

export function parseCommercialStatus(raw: string): CompanyCommercialStatus | null {
  if (!raw.trim()) return null;
  const alias = COMMERCIAL_STATUS_ALIASES[normKey(raw)];
  if (alias) return alias;
  return enumLookup(COMPANY_COMMERCIAL_STATUSES, raw);
}

export function parseCommercialPlanName(raw: string): CompanyCommercialPlanName | null {
  if (!raw.trim()) return null;
  return enumLookup(COMPANY_COMMERCIAL_PLAN_NAMES, raw);
}

export function parseCommercialPaymentStatus(raw: string): CompanyPaymentStatus | null {
  if (!raw.trim()) return null;
  const key = normKey(raw);
  if (key === "na" || key === "n/a" || key === "notapplicable") return "NA";
  if (key === "fullypaid" || key === "paid") return "Fully paid";
  if (key === "partiallypaid" || key === "partial") return "Partially paid";
  if (key === "pending") return "Pending";
  if (key === "partpaymentsubscription" || key === "partpayment") {
    return "Part payment subscription";
  }
  return enumLookup(COMPANY_PAYMENT_STATUSES, raw);
}

/** All commercial sheet plans are annual licenses — map to legacy plan tier. */
function legacyPlanFromCommercialPlan(_planName: CompanyCommercialPlanName): CompanyPlan {
  return "Annual";
}

function isEmptyCommercialCell(raw: string): boolean {
  if (!raw.trim()) return true;
  const key = normKey(raw);
  return !key || key === "na" || key === "nil" || key === "none";
}

function parseInstallmentPending(raw: string, parsedNumber: number | null): {
  pendingAmount: number | null;
  installmentCount: number | null;
} {
  if (isEmptyCommercialCell(raw)) return { pendingAmount: null, installmentCount: null };

  const slash = raw.match(/^(\d+)\s*\/\s*([\d,.]+)$/);
  if (slash) {
    const count = Number(slash[1]);
    const pending = parseNumber(slash[2]);
    return {
      installmentCount: Number.isFinite(count) && count > 0 ? Math.round(count) : null,
      pendingAmount: pending,
    };
  }

  if (parsedNumber != null) {
    if (Number.isInteger(parsedNumber) && parsedNumber > 0 && parsedNumber <= 60 && !raw.includes(".")) {
      return { installmentCount: Math.round(parsedNumber), pendingAmount: null };
    }
    return { pendingAmount: parsedNumber, installmentCount: null };
  }

  return { pendingAmount: null, installmentCount: null };
}

export function downloadCompanyCommercialImportTemplate() {
  const sample = [
    {
      Status: "Live",
      Name: "Skyline Developers",
      Quantity: 40,
      "Total Deal Value": 850000,
      "Amount WITH GST": 1003000,
      Taxable: 850000,
      GST: 153000,
      "Plan Name": "Buildesk Post Sales Annual License Plan",
      "Payment status": "Partially paid",
      "Installment/Pending payment": 350000,
      "Start date": "2026-01-15",
      "End date/ Renewal date": "2027-01-14",
      "Cancelled On": "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, {
    header: [...COMPANY_COMMERCIAL_IMPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Companies");
  XLSX.writeFile(wb, "erp_companies_commercial_update_template.xlsx");
}

export async function parseCompanyCommercialImportFile(
  file: File,
): Promise<CompanyCommercialImportRawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Spreadsheet has no sheets");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("Spreadsheet is empty");

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (json.length === 0) throw new Error("No data rows found — check headers and content");

  const headers = Object.keys(json[0] ?? {});
  const mapped = mapHeaders(headers);
  if (!mapped.Name) {
    throw new Error(
      `Missing required column: Name. Expected headers include: ${COMPANY_COMMERCIAL_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const statusRaw = cellStr(row[mapped.Status ?? ""]);
    const name = cellStr(row[mapped.Name!]);
    const quantityRaw = cellStr(row[mapped.Quantity ?? ""]);
    const totalDealValueRaw = cellStr(row[mapped["Total Deal Value"] ?? ""]);
    const amountWithGstRaw = cellStr(row[mapped["Amount WITH GST"] ?? ""]);
    const taxableRaw = cellStr(row[mapped.Taxable ?? ""]);
    const gstRaw = cellStr(row[mapped.GST ?? ""]);
    const planNameRaw = cellStr(row[mapped["Plan Name"] ?? ""]);
    const paymentStatusRaw = cellStr(row[mapped["Payment status"] ?? ""]);
    const installmentPendingRaw = cellStr(row[mapped["Installment/Pending payment"] ?? ""]);
    const startDateRaw = row[mapped["Start date"] ?? ""];
    const endDateRaw = row[mapped["End date/ Renewal date"] ?? ""];
    const cancelledOnRaw = row[mapped["Cancelled On"] ?? ""];

    const quantity = parseNumber(quantityRaw);
    const totalDealValue = parseNumber(totalDealValueRaw);
    const amountWithGst = parseNumber(amountWithGstRaw);
    const taxableAmount = parseNumber(taxableRaw);
    const gstAmount = parseNumber(gstRaw);
    const installmentParsed = parseNumber(installmentPendingRaw);
    const { pendingAmount, installmentCount } = parseInstallmentPending(
      installmentPendingRaw,
      installmentParsed,
    );
    const startDate = normalizeImportDate(startDateRaw);
    const endDate = normalizeImportDate(endDateRaw);
    const cancelledOn = normalizeImportDate(cancelledOnRaw);

    const commercialStatus = parseCommercialStatus(statusRaw);
    const planName = parseCommercialPlanName(planNameRaw);
    const paymentStatus = parseCommercialPaymentStatus(paymentStatusRaw);

    const parseErrors: string[] = [];
    if (!name) parseErrors.push("Name is required");
    if (statusRaw && !commercialStatus) {
      parseErrors.push(
        `Invalid Status: “${statusRaw}” — use Live, Unpaid, Canceled, Expired, or Future`,
      );
    }
    if (planNameRaw && !planName) {
      parseErrors.push(
        `Invalid Plan Name: “${planNameRaw}” — use one of the three Buildesk annual license plans`,
      );
    }
    if (paymentStatusRaw && !paymentStatus) {
      parseErrors.push(
        `Invalid Payment status: “${paymentStatusRaw}” — use NA, Fully paid, Partially paid, Pending, or Part payment subscription`,
      );
    }
    if (quantityRaw && quantity == null) parseErrors.push(`Invalid Quantity: ${quantityRaw}`);
    if (totalDealValueRaw && totalDealValue == null) {
      parseErrors.push(`Invalid Total Deal Value: ${totalDealValueRaw}`);
    }
    if (amountWithGstRaw && amountWithGst == null) {
      parseErrors.push(`Invalid Amount WITH GST: ${amountWithGstRaw}`);
    }
    if (taxableRaw && taxableAmount == null) parseErrors.push(`Invalid Taxable: ${taxableRaw}`);
    if (gstRaw && gstAmount == null) parseErrors.push(`Invalid GST: ${gstRaw}`);
    if (
      installmentPendingRaw &&
      !isEmptyCommercialCell(installmentPendingRaw) &&
      pendingAmount == null &&
      installmentCount == null
    ) {
      parseErrors.push(`Invalid Installment/Pending payment: ${installmentPendingRaw}`);
    }
    if (cellStr(startDateRaw) && !startDate) {
      parseErrors.push(`Invalid Start date: ${cellStr(startDateRaw)}`);
    }
    if (cellStr(endDateRaw) && !endDate) {
      parseErrors.push(`Invalid End date/ Renewal date: ${cellStr(endDateRaw)}`);
    }
    if (cellStr(cancelledOnRaw) && !cancelledOn) {
      parseErrors.push(`Invalid Cancelled On: ${cellStr(cancelledOnRaw)}`);
    }

    return {
      rowNumber: i + 2,
      statusRaw,
      name,
      quantityRaw,
      totalDealValueRaw,
      amountWithGstRaw,
      taxableRaw,
      gstRaw,
      planNameRaw,
      paymentStatusRaw,
      installmentPendingRaw,
      startDateRaw: cellStr(startDateRaw),
      endDateRaw: cellStr(endDateRaw),
      cancelledOnRaw: cellStr(cancelledOnRaw),
      quantity,
      totalDealValue,
      amountWithGst,
      taxableAmount,
      gstAmount,
      pendingAmount,
      installmentCount,
      startDate,
      endDate,
      cancelledOn,
      commercialStatus,
      planName,
      paymentStatus,
      parseErrors,
    };
  });
}

function commercialFieldsFromRaw(raw: CompanyCommercialImportRawRow) {
  const planName = raw.planName;
  const plan = planName ? legacyPlanFromCommercialPlan(planName) : null;
  return {
    commercialStatus: raw.commercialStatus,
    planName,
    plan,
    usersPurchased: raw.quantity,
    dealSize: raw.totalDealValue,
    totalCost: raw.totalDealValue,
    amountWithGst: raw.amountWithGst,
    taxableAmount: raw.taxableAmount,
    gstAmount: raw.gstAmount,
    paymentStatus: raw.paymentStatus,
    pendingAmount: raw.pendingAmount,
    installmentCount: raw.installmentCount,
    startDate: raw.startDate,
    endDate: raw.endDate,
    planExpiry: raw.endDate,
    cancelledOn: raw.cancelledOn,
  };
}

export function buildCompanyCommercialImportPlan(
  rawRows: CompanyCommercialImportRawRow[],
  companies: Company[],
): CompanyCommercialImportPlan {
  const byName = new Map<string, Company[]>();
  for (const company of companies) {
    const key = normalizeCompanyName(company.name);
    const list = byName.get(key) ?? [];
    list.push(company);
    byName.set(key, list);
  }

  const rows: CompanyCommercialImportPlanRow[] = [];
  let update = 0;
  let skip = 0;
  let notFound = 0;
  let error = 0;
  let ambiguous = 0;

  for (const raw of rawRows) {
    const base = commercialFieldsFromRaw(raw);

    if (raw.parseErrors.length > 0) {
      error += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        name: raw.name,
        ...base,
        paymentReceived: null,
        renewedAt: null,
        action: "error",
        message: raw.parseErrors.join("; "),
      });
      continue;
    }

    if (!raw.name.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        name: "",
        commercialStatus: null,
        planName: null,
        plan: null,
        usersPurchased: null,
        dealSize: null,
        totalCost: null,
        amountWithGst: null,
        taxableAmount: null,
        gstAmount: null,
        paymentStatus: null,
        pendingAmount: null,
        paymentReceived: null,
        installmentCount: null,
        startDate: null,
        endDate: null,
        planExpiry: null,
        renewedAt: null,
        cancelledOn: null,
        action: "skip",
        message: "Empty row skipped",
      });
      continue;
    }

    const matches = byName.get(normalizeCompanyName(raw.name)) ?? [];
    if (matches.length === 0) {
      notFound += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        name: raw.name,
        ...base,
        paymentReceived: null,
        renewedAt: null,
        action: "skip",
        message: `Company “${raw.name}” not found in ERP list`,
      });
      continue;
    }

    if (matches.length > 1) {
      ambiguous += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        name: raw.name,
        ...base,
        paymentReceived: null,
        renewedAt: null,
        action: "error",
        message: `Multiple companies match “${raw.name}” (${matches.length}) — rename duplicates first`,
      });
      continue;
    }

    const existing = matches[0]!;
    const dealBase =
      raw.totalDealValue ?? raw.amountWithGst ?? existing.dealSize ?? existing.totalCost;
    const pendingAmount =
      raw.pendingAmount ?? (raw.paymentStatus === "Fully paid" ? 0 : null);
    let paymentReceived: number | null = null;
    if (pendingAmount != null && dealBase != null) {
      paymentReceived = roundMoney(Math.max(0, dealBase - pendingAmount));
    } else if (raw.amountWithGst != null && pendingAmount != null) {
      paymentReceived = roundMoney(Math.max(0, raw.amountWithGst - pendingAmount));
    }

    update += 1;
    rows.push({
      rowNumber: raw.rowNumber,
      name: raw.name,
      ...base,
      pendingAmount,
      totalCost: raw.totalDealValue ?? raw.amountWithGst,
      paymentReceived,
      renewedAt: null,
      action: "update",
      existingId: existing.id,
      existingName: existing.name,
      message: `Update ${existing.name}`,
    });
  }

  return {
    rows,
    summary: { update, skip, notFound, error, ambiguous },
  };
}

export function mergeCompanyCommercialImportRow(
  row: CompanyCommercialImportPlanRow,
  existing: Company,
): { id: string; patch: CompanyCommercialPatch } {
  const patch: CompanyCommercialPatch = {};

  if (row.commercialStatus) patch.commercialStatus = row.commercialStatus;
  if (row.planName) {
    patch.planName = row.planName;
    patch.plan = legacyPlanFromCommercialPlan(row.planName);
  } else if (row.plan) {
    patch.plan = row.plan;
  }
  if (row.usersPurchased != null) patch.usersPurchased = Math.max(0, Math.round(row.usersPurchased));
  if (row.dealSize != null) {
    patch.dealSize = row.dealSize;
    patch.totalCost = row.dealSize;
  } else if (row.totalCost != null) {
    patch.totalCost = row.totalCost;
  }
  if (row.amountWithGst != null) patch.amountWithGst = row.amountWithGst;
  if (row.taxableAmount != null) patch.taxableAmount = row.taxableAmount;
  if (row.gstAmount != null) patch.gstAmount = row.gstAmount;
  if (row.paymentStatus) patch.paymentStatus = row.paymentStatus;
  if (row.pendingAmount != null) patch.pendingAmount = row.pendingAmount;
  if (row.paymentReceived != null) patch.paymentReceived = row.paymentReceived;
  if (row.installmentCount != null) patch.installmentCount = row.installmentCount;
  if (row.startDate) patch.startDate = row.startDate;
  if (row.endDate) {
    patch.endDate = row.endDate;
    patch.planExpiry = row.endDate;
  }
  if (row.renewedAt) patch.renewedAt = row.renewedAt;
  if (row.cancelledOn) patch.cancelledOn = row.cancelledOn;

  return { id: existing.id, patch };
}
