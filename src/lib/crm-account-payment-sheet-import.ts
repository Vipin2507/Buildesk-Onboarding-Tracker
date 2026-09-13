import * as XLSX from "xlsx";

import {
  calcInstallmentAmount,
  roundMoney,
  serializeInstallments,
  validateInstallmentTotal,
} from "@/lib/crm-account-commercial";
import { normalizeImportDate } from "@/lib/project-sheet-import";
import type { CrmAccount, CrmAccountInstallment } from "@/types/crm-account";

/** Headers from the CRM payments bulk-update sheet. */
export const CRM_ACCOUNT_PAYMENT_IMPORT_HEADERS = [
  "Account",
  "User Id",
  "Deal value with gst",
  "Deal value without GST",
  "Paid",
  "Pending",
  "Installment date",
  "Installment Amount",
] as const;

export type CrmAccountPaymentImportHeader = (typeof CRM_ACCOUNT_PAYMENT_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<CrmAccountPaymentImportHeader, string[]> = {
  Account: ["account", "accountname", "companyname", "company", "name", "client"],
  "User Id": ["userid", "user id", "clientid", "client id", "portaluserid"],
  "Deal value with gst": [
    "dealvaluewithgst",
    "dealwithgst",
    "amountwithgst",
    "totalwithgst",
    "dealsize",
    "dealvalue",
  ],
  "Deal value without GST": [
    "dealvaluewithoutgst",
    "dealwithoutgst",
    "taxable",
    "taxableamount",
    "deal ex gst",
    "dealexgst",
  ],
  Paid: ["paid", "paymentreceived", "received", "collected"],
  Pending: ["pending", "pendingamount", "balance", "outstanding"],
  "Installment date": [
    "installmentdate",
    "instalmentdate",
    "duedate",
    "installment dates",
    "due dates",
  ],
  "Installment Amount": [
    "installmentamount",
    "instalmentamount",
    "installment",
    "installment amounts",
  ],
};

export type CrmAccountPaymentImportRawRow = {
  rowNumber: number;
  accountName: string;
  userIdRaw: string;
  dealWithGstRaw: string;
  dealExGstRaw: string;
  paidRaw: string;
  pendingRaw: string;
  installmentDatesRaw: string;
  installmentAmountsRaw: string;
  dealWithGst: number | null;
  dealExGst: number | null;
  paid: number | null;
  pending: number | null;
  parseErrors: string[];
};

export type CrmAccountPaymentImportPlanRow = {
  rowNumber: number;
  accountName: string;
  userId: string | null;
  dealSize: number | null;
  gstPercent: number | null;
  paymentReceived: number | null;
  pendingAmount: number | null;
  installments: CrmAccountInstallment[];
  installmentCount: number;
  action: "update" | "skip" | "error" | "pick";
  existingId?: string;
  existingName?: string;
  needsAccountPick?: boolean;
  message: string;
};

export type CrmAccountPaymentImportPlan = {
  rows: CrmAccountPaymentImportPlanRow[];
  summary: {
    update: number;
    skip: number;
    error: number;
    notFound: number;
    ambiguous: number;
    needsAccountPick: number;
  };
};

export type CrmAccountPaymentPickOverrides = Record<number, string>;

function normKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./]+/g, "");
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).replace(/[,₹$]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Split "01-07-2027 & 01-07-2028" or comma-separated lists. */
export function splitSheetList(value: string): string[] {
  const raw = value.trim();
  if (!raw) return [];
  return raw
    .split(/\s*&\s*|\s*;\s*|\s*,\s*(?=\d)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapHeaders(keys: string[]) {
  const mapped: Partial<Record<CrmAccountPaymentImportHeader, string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of CRM_ACCOUNT_PAYMENT_IMPORT_HEADERS) {
    const aliases = new Set([normKey(header), ...HEADER_ALIASES[header]]);
    const hit = normalized.find((k) => aliases.has(k.key));
    if (hit) mapped[header] = hit.raw;
  }

  return mapped;
}

export function normalizeCrmPaymentAccountName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function inferGstPercent(dealWithGst: number, dealExGst: number): number | null {
  if (dealWithGst <= 0 || dealExGst <= 0) return null;
  if (dealExGst >= dealWithGst) return 0;
  const rate = (dealWithGst / dealExGst - 1) * 100;
  return roundMoney(rate);
}

/** Build installment rows from sheet date / amount cells (supports & lists). */
export function buildInstallmentsFromPaymentSheet(input: {
  dealSize: number;
  pendingAmount: number;
  installmentDatesRaw: string;
  installmentAmountsRaw: string;
}): { installments: CrmAccountInstallment[]; errors: string[] } {
  const errors: string[] = [];
  const dateParts = splitSheetList(input.installmentDatesRaw);
  const amountParts = splitSheetList(input.installmentAmountsRaw);

  if (dateParts.length === 0 && amountParts.length === 0) {
    return { installments: [], errors: [] };
  }

  const dueDates: string[] = [];
  for (const part of dateParts) {
    const ymd = normalizeImportDate(part);
    if (!ymd) errors.push(`Invalid installment date: ${part}`);
    else dueDates.push(ymd);
  }

  const amounts: number[] = [];
  for (const part of amountParts) {
    const n = parseNumber(part);
    if (n == null) errors.push(`Invalid installment amount: ${part}`);
    else amounts.push(roundMoney(n));
  }

  if (dueDates.length === 0) {
    if (amountParts.length) errors.push("Installment date is required when amounts are provided");
    return { installments: [], errors };
  }

  dueDates.sort((a, b) => a.localeCompare(b));

  let rowAmounts: number[] = [];
  const pending = roundMoney(Math.max(0, input.pendingAmount));
  const deal = roundMoney(Math.max(0, input.dealSize));

  if (amounts.length === dueDates.length) {
    rowAmounts = amounts;
  } else if (amounts.length === 1 && dueDates.length > 1) {
    const single = amounts[0]!;
    if (Math.abs(single - pending) < 0.02) {
      const each = calcInstallmentAmount(pending, dueDates.length);
      let allocated = 0;
      rowAmounts = dueDates.map((_, i) => {
        const isLast = i === dueDates.length - 1;
        const amount = isLast ? roundMoney(pending - allocated) : each;
        allocated = roundMoney(allocated + amount);
        return amount;
      });
    } else if (Math.abs(single * dueDates.length - pending) < 0.02) {
      rowAmounts = dueDates.map(() => single);
    } else {
      rowAmounts = dueDates.map(() => single);
      errors.push(
        `Installment amount × ${dueDates.length} (₹${roundMoney(single * dueDates.length).toLocaleString("en-IN")}) does not match pending (₹${pending.toLocaleString("en-IN")}) — using ₹${single.toLocaleString("en-IN")} per date`,
      );
    }
  } else if (amounts.length === 0 && pending > 0) {
    const each = calcInstallmentAmount(pending, dueDates.length);
    let allocated = 0;
    rowAmounts = dueDates.map((_, i) => {
      const isLast = i === dueDates.length - 1;
      const amount = isLast ? roundMoney(pending - allocated) : each;
      allocated = roundMoney(allocated + amount);
      return amount;
    });
  } else {
    errors.push(
      `Expected ${dueDates.length} installment amount(s) (use & between values) or one amount equal to pending`,
    );
    return { installments: [], errors };
  }

  const installments = dueDates.map((dueDate, i) => ({
    dueDate,
    amount: rowAmounts[i] ?? 0,
  }));

  if (deal > 0 || pending > 0) {
    const check = validateInstallmentTotal(deal, pending, installments);
    if (!check.ok && check.message) errors.push(check.message);
  }

  return { installments, errors };
}

export function downloadCrmAccountPaymentImportTemplate() {
  const sample = [
    {
      Account: "Panjwani Developers",
      "User Id": "125975",
      "Deal value with gst": 415360,
      "Deal value without GST": 352000,
      Paid: 236000,
      Pending: 179360,
      "Installment date": "01-07-2027 & 01-07-2028 & 01-07-2029",
      "Installment Amount": 179360,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, {
    header: [...CRM_ACCOUNT_PAYMENT_IMPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payments");
  XLSX.writeFile(wb, "crm_payments_bulk_update_template.xlsx");
}

export async function parseCrmAccountPaymentImportFile(
  file: File,
): Promise<CrmAccountPaymentImportRawRow[]> {
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
  const missing = (["Account"] as CrmAccountPaymentImportHeader[]).filter((h) => !mapped[h]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Expected: ${CRM_ACCOUNT_PAYMENT_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const accountName = cellStr(row[mapped.Account!]);
    const userIdRaw = cellStr(row[mapped["User Id"] ?? ""]);
    const dealWithGstRaw = cellStr(row[mapped["Deal value with gst"] ?? ""]);
    const dealExGstRaw = cellStr(row[mapped["Deal value without GST"] ?? ""]);
    const paidRaw = cellStr(row[mapped.Paid ?? ""]);
    const pendingRaw = cellStr(row[mapped.Pending ?? ""]);
    const installmentDatesRaw = cellStr(row[mapped["Installment date"] ?? ""]);
    const installmentAmountsRaw = cellStr(row[mapped["Installment Amount"] ?? ""]);

    const dealWithGst = parseNumber(dealWithGstRaw);
    const dealExGst = parseNumber(dealExGstRaw);
    const paid = parseNumber(paidRaw);
    const pending = parseNumber(pendingRaw);
    const parseErrors: string[] = [];

    if (!accountName && !userIdRaw) parseErrors.push("Account or User Id is required");
    if (dealWithGstRaw && dealWithGst == null) parseErrors.push(`Invalid deal value with GST: ${dealWithGstRaw}`);
    if (dealExGstRaw && dealExGst == null) parseErrors.push(`Invalid deal value without GST: ${dealExGstRaw}`);
    if (paidRaw && paid == null) parseErrors.push(`Invalid Paid: ${paidRaw}`);
    if (pendingRaw && pending == null) parseErrors.push(`Invalid Pending: ${pendingRaw}`);

    if (dealWithGst != null && paid != null && pending != null) {
      const sum = roundMoney(paid + pending);
      if (Math.abs(sum - dealWithGst) > 0.02) {
        parseErrors.push(
          `Paid + Pending (₹${sum.toLocaleString("en-IN")}) should match deal with GST (₹${dealWithGst.toLocaleString("en-IN")})`,
        );
      }
    }

    return {
      rowNumber: i + 2,
      accountName,
      userIdRaw,
      dealWithGstRaw,
      dealExGstRaw,
      paidRaw,
      pendingRaw,
      installmentDatesRaw,
      installmentAmountsRaw,
      dealWithGst,
      dealExGst,
      paid,
      pending,
      parseErrors,
    };
  });
}

function resolveAccountMatch(
  raw: CrmAccountPaymentImportRawRow,
  accounts: CrmAccount[],
): CrmAccount[] {
  const userId = raw.userIdRaw.trim();
  if (userId) {
    const key = normKey(userId);
    const byId = accounts.filter((a) => a.userId?.trim() && normKey(a.userId) === key);
    if (byId.length) return byId;
  }
  const nameKey = normalizeCrmPaymentAccountName(raw.accountName);
  if (!nameKey) return [];
  return accounts.filter((a) => normalizeCrmPaymentAccountName(a.name) === nameKey);
}

function buildPlanRowFromMatch(
  raw: CrmAccountPaymentImportRawRow,
  account: CrmAccount,
): CrmAccountPaymentImportPlanRow {
  const dealSize = raw.dealWithGst ?? account.dealSize ?? null;
  const gstPercent =
    raw.dealWithGst != null && raw.dealExGst != null
      ? inferGstPercent(raw.dealWithGst, raw.dealExGst)
      : account.gstPercent ?? null;
  const paymentReceived = raw.paid;
  const pendingAmount = raw.pending ?? (dealSize != null && raw.paid != null ? roundMoney(dealSize - raw.paid) : null);

  const { installments, errors: installmentErrors } =
    dealSize != null && pendingAmount != null
      ? buildInstallmentsFromPaymentSheet({
          dealSize,
          pendingAmount,
          installmentDatesRaw: raw.installmentDatesRaw,
          installmentAmountsRaw: raw.installmentAmountsRaw,
        })
      : { installments: [] as CrmAccountInstallment[], errors: [] as string[] };

  const allErrors = [...raw.parseErrors, ...installmentErrors];
  if (allErrors.length) {
    return {
      rowNumber: raw.rowNumber,
      accountName: raw.accountName || account.name,
      userId: raw.userIdRaw || account.userId || null,
      dealSize,
      gstPercent,
      paymentReceived,
      pendingAmount,
      installments,
      installmentCount: installments.length,
      action: "error",
      existingId: account.id,
      existingName: account.name,
      message: allErrors.join("; "),
    };
  }

  return {
    rowNumber: raw.rowNumber,
    accountName: raw.accountName || account.name,
    userId: raw.userIdRaw || account.userId || null,
    dealSize,
    gstPercent,
    paymentReceived,
    pendingAmount,
    installments,
    installmentCount: installments.length,
    action: "update",
    existingId: account.id,
    existingName: account.name,
    message: `Update ${account.name}`,
  };
}

export function buildCrmAccountPaymentImportPlan(
  rawRows: CrmAccountPaymentImportRawRow[],
  accounts: CrmAccount[],
  accountPicks: CrmAccountPaymentPickOverrides = {},
): CrmAccountPaymentImportPlan {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const rows: CrmAccountPaymentImportPlanRow[] = [];
  let update = 0;
  let skip = 0;
  let error = 0;
  let notFound = 0;
  let ambiguous = 0;
  let needsAccountPick = 0;

  for (const raw of rawRows) {
    if (!raw.accountName.trim() && !raw.userIdRaw.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        accountName: "",
        userId: null,
        dealSize: null,
        gstPercent: null,
        paymentReceived: null,
        pendingAmount: null,
        installments: [],
        installmentCount: 0,
        action: "skip",
        message: "Empty row skipped",
      });
      continue;
    }

    if (raw.rowNumber in accountPicks) {
      const pick = accountPicks[raw.rowNumber]!;
      if (!pick) {
        skip += 1;
        rows.push({
          rowNumber: raw.rowNumber,
          accountName: raw.accountName,
          userId: raw.userIdRaw || null,
          dealSize: null,
          gstPercent: null,
          paymentReceived: null,
          pendingAmount: null,
          installments: [],
          installmentCount: 0,
          action: "skip",
          message: "Skipped manually",
        });
        continue;
      }
      const picked = accountsById.get(pick);
      if (picked) {
        const row = buildPlanRowFromMatch(raw, picked);
        if (row.action === "update") update += 1;
        else error += 1;
        rows.push(row);
        continue;
      }
    }

    const matches = resolveAccountMatch(raw, accounts);
    if (matches.length === 0) {
      notFound += 1;
      needsAccountPick += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        accountName: raw.accountName || raw.userIdRaw,
        userId: raw.userIdRaw || null,
        dealSize: raw.dealWithGst,
        gstPercent: null,
        paymentReceived: raw.paid,
        pendingAmount: raw.pending,
        installments: [],
        installmentCount: 0,
        action: "pick",
        needsAccountPick: true,
        message: `Account “${raw.accountName || raw.userIdRaw}” not found — pick a CRM account or skip`,
      });
      continue;
    }

    if (matches.length > 1) {
      ambiguous += 1;
      needsAccountPick += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        accountName: raw.accountName || raw.userIdRaw,
        userId: raw.userIdRaw || null,
        dealSize: raw.dealWithGst,
        gstPercent: null,
        paymentReceived: raw.paid,
        pendingAmount: raw.pending,
        installments: [],
        installmentCount: 0,
        action: "pick",
        needsAccountPick: true,
        message: `${matches.length} accounts match — pick the correct one or skip`,
      });
      continue;
    }

    const row = buildPlanRowFromMatch(raw, matches[0]!);
    if (row.action === "update") update += 1;
    else error += 1;
    rows.push(row);
  }

  return {
    rows,
    summary: { update, skip, error, notFound, ambiguous, needsAccountPick },
  };
}

export type CrmAccountPaymentBulkPatch = {
  accountId: string;
  userId?: string | null;
  dealSize?: number | null;
  gstPercent?: number | null;
  targetPaid?: number | null;
  pendingAmount?: number | null;
  installmentCount?: number | null;
  installmentsJson?: string | null;
};

export function mergeCrmAccountPaymentImportRow(
  row: CrmAccountPaymentImportPlanRow,
): CrmAccountPaymentBulkPatch {
  return {
    accountId: row.existingId!,
    userId: row.userId,
    dealSize: row.dealSize,
    gstPercent: row.gstPercent,
    targetPaid: row.paymentReceived,
    pendingAmount: row.pendingAmount,
    installmentCount: row.installmentCount > 0 ? row.installmentCount : null,
    installmentsJson:
      row.installments.length > 0 ? serializeInstallments(row.installments) : null,
  };
}
