import * as XLSX from "xlsx";

import { isEmptyImportDateValue, normalizeImportDate } from "@/lib/project-sheet-import";

export type SeatSheetInput = {
  accountName: string;
  userId: string;
  startDate: string | null;
  endDate: string | null;
  dealValue: number | null;
  dealValueWithGst: number | null;
  users: number | null;
  upgrade: number | null;
  degrade: number | null;
};

export type SeatSheetRow = SeatSheetInput & {
  id: string;
  accountId: string;
  salesManagerName: string | null;
  updatedAt: string;
};

export type SeatEconomics = {
  base: number | null;
  valuePerUser: number | null;
  upgradeValue: number | null;
  degradeValue: number | null;
  netValue: number | null;
  netSeats: number;
};

const HEADER_ALIASES: Record<string, keyof SeatSheetInput | "skip"> = {};

function alias(header: string, field: keyof SeatSheetInput) {
  HEADER_ALIASES[header.toLowerCase().replace(/[\s_\-./]+/g, "")] = field;
}

alias("account", "accountName");
alias("accountname", "accountName");
alias("company", "accountName");
alias("userid", "userId");
alias("user id", "userId");
alias("startdate", "startDate");
alias("start date", "startDate");
alias("enddate", "endDate");
alias("end date", "endDate");
alias("dealvalue", "dealValue");
alias("deal value", "dealValue");
alias("dealvaluewithgst", "dealValueWithGst");
alias("deal value with gst", "dealValueWithGst");
alias("users", "users");
alias("upgrade", "upgrade");
alias("degrade", "degrade");

function headerKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  const text = String(value).replace(/[₹,\s]/g, "").replace(/−/g, "-");
  if (!text || text === "-" || text === "—") return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function seats(value: unknown): number | null {
  const n = money(value);
  if (n == null) return null;
  return Math.round(n);
}

function dateCell(value: unknown): string | null {
  if (isEmptyImportDateValue(value)) return null;
  return normalizeImportDate(value);
}

export function seatEconomics(row: Pick<
  SeatSheetInput,
  "dealValue" | "dealValueWithGst" | "users" | "upgrade" | "degrade"
>): SeatEconomics {
  const base = row.dealValue ?? row.dealValueWithGst;
  const userCount = row.users ?? 0;
  const upgrade = row.upgrade ?? 0;
  const degrade = row.degrade ?? 0;
  const valuePerUser =
    userCount > 0 && base != null ? Math.round((base / userCount) * 100) / 100 : null;
  const scale = (count: number) =>
    valuePerUser == null ? null : Math.round(count * valuePerUser * 100) / 100;
  return {
    base,
    valuePerUser,
    upgradeValue: scale(upgrade),
    degradeValue: scale(degrade),
    netValue: scale(upgrade - degrade),
    netSeats: upgrade - degrade,
  };
}

export function parseSeatSheet(buffer: ArrayBuffer): { rows: SeatSheetInput[]; errors: string[] } {
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) return { rows: [], errors: ["The workbook has no sheet."] };
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => headerKey(cell) === "account" || headerKey(cell) === "userid"),
  );
  if (headerIndex < 0) {
    return { rows: [], errors: ["Could not find an Account or User Id column."] };
  }
  const headers = matrix[headerIndex] ?? [];
  const columns = headers.map((cell) => HEADER_ALIASES[headerKey(cell)]);
  if (!columns.includes("accountName") && !columns.includes("userId")) {
    return { rows: [], errors: ["The sheet needs an Account or User Id column."] };
  }
  const rows: SeatSheetInput[] = [];
  const errors: string[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    if (line.every((cell) => String(cell ?? "").trim() === "")) continue;
    const draft: SeatSheetInput = {
      accountName: "",
      userId: "",
      startDate: null,
      endDate: null,
      dealValue: null,
      dealValueWithGst: null,
      users: null,
      upgrade: null,
      degrade: null,
    };
    columns.forEach((field, index) => {
      if (!field) return;
      const cell = line[index];
      if (field === "accountName" || field === "userId") {
        draft[field] = String(cell ?? "").trim();
      } else if (field === "startDate" || field === "endDate") {
        draft[field] = dateCell(cell);
      } else if (field === "dealValue" || field === "dealValueWithGst") {
        draft[field] = money(cell);
      } else if (field === "users" || field === "upgrade" || field === "degrade") {
        draft[field] = seats(cell);
      }
    });
    if (!draft.accountName && !draft.userId) {
      errors.push(`Row ${i + 1} has no account name or user id.`);
      continue;
    }
    rows.push(draft);
  }
  if (rows.length === 0) errors.push("No data rows were found.");
  return { rows, errors };
}
