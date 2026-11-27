import * as XLSX from "xlsx";

import { isEmptyImportDateValue, normalizeImportDate } from "@/lib/project-sheet-import";

export type RenewalYearCell = {
  fyStartYear: number;
  /** Null means the sheet cell was empty: not started, or not renewed for that year. */
  dealValue: number | null;
};

export function normalizeRenewalAccountName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact name, then a single unique partial name of at least 4 characters. */
export function matchRenewalYearAccount(
  accountName: string,
  accounts: { id: string; name: string }[],
): { accountId?: string; reason?: string } {
  const nameKey = normalizeRenewalAccountName(accountName);
  if (!nameKey) return { reason: "Missing account name." };
  const byName = new Map<string, string[]>();
  for (const account of accounts) {
    const key = normalizeRenewalAccountName(account.name);
    const list = byName.get(key) ?? [];
    list.push(account.id);
    byName.set(key, list);
  }
  const exact = byName.get(nameKey) ?? [];
  if (exact.length === 1) return { accountId: exact[0] };
  if (exact.length > 1) return { reason: "More than one account has this name." };
  if (nameKey.length >= 4) {
    const fuzzy = accounts.filter((account) => {
      const name = normalizeRenewalAccountName(account.name);
      return name.includes(nameKey) || nameKey.includes(name);
    });
    if (fuzzy.length === 1 && fuzzy[0]) return { accountId: fuzzy[0].id };
    if (fuzzy.length > 1) return { reason: "Several accounts look like this name." };
  }
  return { reason: "No matching CRM account." };
}

export type RenewalYearSheetRow = {
  accountName: string;
  startDate: string | null;
  endDate: string | null;
  years: RenewalYearCell[];
};

export type RenewalYearValue = {
  fyStartYear: number;
  dealValue: number;
};

export type RenewalYearSummary = {
  renewalCount: number;
  lifetimeValue: number;
  renewedThisYear: boolean;
  /** True when at least one financial year was imported or recorded. */
  yearsKnown: boolean;
  currentFyStart: number;
  currentFyLabel: string;
  latestFyLabel: string | null;
  /** Financial year of the current contract, after Renew. */
  cycleFyStart: number | null;
  years: { fyStartYear: number; label: string; dealValue: number }[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Indian financial year starts on 1 April. */
export function financialYearStartYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function financialYearStartFromYmd(ymd: string | null | undefined): number | null {
  const text = ymd?.slice(0, 10) ?? "";
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return month >= 4 ? year : year - 1;
}

export function financialYearLabel(startYear: number): string {
  const start = String(startYear % 100).padStart(2, "0");
  const end = String((startYear + 1) % 100).padStart(2, "0");
  return `${start}-${end}`;
}

/** "21-22" or "2021-22" → 2021. The second part must be the following year. */
export function parseFinancialYearHeader(raw: string): number | null {
  const text = raw.trim().replace(/[–—]/g, "-");
  const match = /^(\d{2}|\d{4})\s*-\s*(\d{2}|\d{4})$/.exec(text);
  if (!match) return null;
  const startDigits = Number(match[1]);
  const startYear = match[1].length === 2 ? (startDigits >= 80 ? 1900 : 2000) + startDigits : startDigits;
  const endDigits = Number(match[2].slice(-2));
  if (((startYear + 1) % 100) !== endDigits) return null;
  if (startYear < 1990 || startYear > 2100) return null;
  return startYear;
}

/** Years after the first filled year. A Renew-button cycle with no earlier year is itself a renewal. */
export function renewalYearDeals(summary: RenewalYearSummary) {
  if (!summary.yearsKnown || summary.years.length === 0) return [];
  const onlyCycleYear =
    summary.renewalCount > 0 &&
    summary.years.length === 1 &&
    summary.cycleFyStart != null &&
    summary.years[0]?.fyStartYear === summary.cycleFyStart;
  if (onlyCycleYear) return summary.years;
  return summary.years.slice(1);
}

export function sumRenewalDealValue(summary: RenewalYearSummary) {
  const total = renewalYearDeals(summary).reduce((sum, year) => sum + year.dealValue, 0);
  return Math.round(total * 100) / 100;
}

export function summarizeAccountRenewals(input: {
  years: RenewalYearValue[];
  currentDeal: number | null;
  hasRenewalCycle: boolean;
  /** Start date of the contract open now. After Renew, this is the new period. */
  cycleStartDate?: string | null;
  now?: Date;
}): RenewalYearSummary {
  const currentFyStart = financialYearStartYear(input.now ?? new Date());
  const cycleFy = input.hasRenewalCycle ? financialYearStartFromYmd(input.cycleStartDate) : null;
  const currentDeal =
    input.currentDeal != null && Number.isFinite(input.currentDeal) ? roundMoney(input.currentDeal) : 0;
  const years = input.years
    .filter(
      (year) =>
        Number.isFinite(year.fyStartYear) && Number.isFinite(year.dealValue) && year.dealValue > 0.01,
    )
    .map((year) => ({
      fyStartYear: year.fyStartYear,
      dealValue: roundMoney(year.dealValue),
      label: financialYearLabel(year.fyStartYear),
    }))
    .sort((a, b) => a.fyStartYear - b.fyStartYear);

  if (cycleFy != null && currentDeal > 0.01 && !years.some((year) => year.fyStartYear === cycleFy)) {
    years.push({
      fyStartYear: cycleFy,
      dealValue: currentDeal,
      label: financialYearLabel(cycleFy),
    });
    years.sort((a, b) => a.fyStartYear - b.fyStartYear);
  }

  const empty = {
    renewedThisYear: false,
    yearsKnown: false,
    currentFyStart,
    currentFyLabel: financialYearLabel(currentFyStart),
    latestFyLabel: null,
    cycleFyStart: cycleFy,
    years: [],
  };

  if (years.length === 0) {
    return {
      ...empty,
      renewalCount: input.hasRenewalCycle ? 1 : 0,
      lifetimeValue: currentDeal,
    };
  }

  const cycleYearIsTheOnlyYear =
    input.hasRenewalCycle && years.length === 1 && years[0]?.fyStartYear === cycleFy;

  return {
    renewalCount: cycleYearIsTheOnlyYear ? 1 : Math.max(0, years.length - 1),
    lifetimeValue: roundMoney(years.reduce((sum, year) => sum + year.dealValue, 0)),
    renewedThisYear: years.some((year) => year.fyStartYear === currentFyStart),
    yearsKnown: true,
    currentFyStart,
    currentFyLabel: financialYearLabel(currentFyStart),
    latestFyLabel: years[years.length - 1]?.label ?? null,
    cycleFyStart: cycleFy,
    years,
  };
}

function headerKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_./]+/g, "");
}

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  const text = String(value).replace(/[₹,\s]/g, "").replace(/−/g, "-");
  if (!text || text === "-" || text === "—" || text === "–") return null;
  const n = Number(text);
  return Number.isFinite(n) ? roundMoney(n) : null;
}

function dateCell(value: unknown): string | null {
  if (isEmptyImportDateValue(value)) return null;
  return normalizeImportDate(value);
}

const ACCOUNT_HEADERS = new Set(["account", "accountname", "company", "companyname"]);
const START_HEADERS = new Set(["startdate", "start"]);
const END_HEADERS = new Set(["enddate", "end"]);

export function parseRenewalYearSheet(buffer: ArrayBuffer): {
  rows: RenewalYearSheetRow[];
  errors: string[];
} {
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) return { rows: [], errors: ["The workbook has no sheet."] };
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => ACCOUNT_HEADERS.has(headerKey(cell))),
  );
  if (headerIndex < 0) {
    return { rows: [], errors: ["Could not find an Account column."] };
  }
  const headers = matrix[headerIndex] ?? [];
  const accountIndex = headers.findIndex((cell) => ACCOUNT_HEADERS.has(headerKey(cell)));
  const startIndex = headers.findIndex((cell) => START_HEADERS.has(headerKey(cell)));
  const endIndex = headers.findIndex((cell) => END_HEADERS.has(headerKey(cell)));
  const yearColumns = headers
    .map((cell, index) => ({ index, fyStartYear: parseFinancialYearHeader(String(cell ?? "")) }))
    .filter((column): column is { index: number; fyStartYear: number } => column.fyStartYear != null);
  if (yearColumns.length === 0) {
    return { rows: [], errors: ["Add year columns such as 21-22, 22-23."] };
  }

  const rows: RenewalYearSheetRow[] = [];
  const errors: string[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    if (line.every((cell) => String(cell ?? "").trim() === "")) continue;
    const accountName = String(line[accountIndex] ?? "").trim();
    if (!accountName) {
      errors.push(`Row ${i + 1} has no account name.`);
      continue;
    }
    const byYear = new Map<number, number | null>();
    for (const column of yearColumns) {
      byYear.set(column.fyStartYear, money(line[column.index]));
    }
    rows.push({
      accountName,
      startDate: startIndex >= 0 ? dateCell(line[startIndex]) : null,
      endDate: endIndex >= 0 ? dateCell(line[endIndex]) : null,
      years: [...byYear.entries()].map(([fyStartYear, dealValue]) => ({ fyStartYear, dealValue })),
    });
  }
  if (rows.length === 0) errors.push("No data rows were found.");
  return { rows, errors };
}
