import * as XLSX from "xlsx";

import { normalizeManagerName } from "@/lib/crm-account-sheet-import";
import { normalizeImportDate } from "@/lib/project-sheet-import";
import type { CrmAccount } from "@/types/crm-account";

export const CRM_ACCOUNT_DATE_IMPORT_HEADERS = [
  "S.No",
  "Client Id",
  "Users",
  "Start Date",
  "End Date",
] as const;

type DateImportHeader = (typeof CRM_ACCOUNT_DATE_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<DateImportHeader, string[]> = {
  "S.No": ["sno", "srno", "serialno", "serialnumber", "#"],
  "Client Id": ["clientid", "userid", "clinetid", "accountid", "client"],
  Users: ["users", "userspurchased", "userpurchased", "licences", "licenses", "seats"],
  "Start Date": ["startdate", "start", "fromdate"],
  "End Date": ["enddate", "end", "todate", "expiry"],
};

export type CrmAccountDateImportRawRow = {
  rowNumber: number;
  serialNo: string;
  clientId: string;
  usersRaw: string;
  usersPurchased: number | null;
  startDateRaw: string;
  endDateRaw: string;
  startDate: string | null;
  endDate: string | null;
  parseErrors: string[];
};

export type CrmAccountDateImportPlanRow = {
  rowNumber: number;
  key: string;
  clientId: string;
  usersPurchased: number | null;
  startDate: string | null;
  endDate: string | null;
  action: "update" | "skip" | "error" | "not_found";
  existingId?: string;
  existingName?: string;
  previousUsers?: number;
  previousStartDate?: string;
  previousEndDate?: string;
  applyUsers?: number;
  applyStartDate?: string;
  applyEndDate?: string;
  message: string;
};

export type CrmAccountDateImportPlan = {
  rows: CrmAccountDateImportPlanRow[];
  summary: {
    update: number;
    skip: number;
    error: number;
    notFound: number;
  };
};

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
  const cleaned = String(value).replace(/[,\s₹$]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapHeaders(keys: string[]) {
  const mapped: Partial<Record<DateImportHeader, string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of CRM_ACCOUNT_DATE_IMPORT_HEADERS) {
    const aliases = new Set([normKey(header), ...HEADER_ALIASES[header]]);
    const hit = normalized.find((k) => aliases.has(k.key));
    if (hit) mapped[header] = hit.raw;
  }

  return mapped;
}

function matchAccountByClientId(accounts: CrmAccount[], clientId: string) {
  const needle = normalizeManagerName(clientId);
  if (!needle) return undefined;

  const compact = (s: string) => s.replace(/\s+/g, "");
  const hits = accounts.filter((a) => {
    const uid = a.userId?.trim();
    if (!uid) return false;
    const normalized = normalizeManagerName(uid);
    return normalized === needle || compact(normalized) === compact(needle);
  });

  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return hits[0];

  return undefined;
}

export function downloadCrmAccountDateImportTemplate() {
  const sample = [
    {
      "S.No": 1,
      "Client Id": "126493",
      Users: 12,
      "Start Date": "9/26/2026",
      "End Date": "9/25/2027",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, {
    header: [...CRM_ACCOUNT_DATE_IMPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dates");
  XLSX.writeFile(wb, "crm_account_dates_update_template.xlsx");
}

export async function parseCrmAccountDateImportFile(file: File): Promise<CrmAccountDateImportRawRow[]> {
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
  if (!mapped["Client Id"]) {
    throw new Error(
      `Missing required column: Client Id. Expected headers: ${CRM_ACCOUNT_DATE_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const serialNo = cellStr(row[mapped["S.No"] ?? ""]);
    const clientId = cellStr(row[mapped["Client Id"]!]);
    const usersCell = row[mapped.Users ?? ""];
    const usersRaw = cellStr(usersCell);
    const usersPurchased = parseNumber(usersCell);
    const startRaw = row[mapped["Start Date"] ?? ""];
    const endRaw = row[mapped["End Date"] ?? ""];

    const startDate = normalizeImportDate(startRaw);
    const endDate = normalizeImportDate(endRaw);
    const parseErrors: string[] = [];

    if (!clientId.trim()) parseErrors.push("Client Id is required");
    if (!usersRaw && !cellStr(startRaw) && !cellStr(endRaw)) {
      parseErrors.push("At least one of Users, Start Date, or End Date is required");
    }
    if (usersRaw && usersPurchased == null) parseErrors.push(`Invalid Users: ${usersRaw}`);
    if (cellStr(startRaw) && !startDate) parseErrors.push(`Invalid Start Date: ${cellStr(startRaw)}`);
    if (cellStr(endRaw) && !endDate) parseErrors.push(`Invalid End Date: ${cellStr(endRaw)}`);

    return {
      rowNumber: i + 2,
      serialNo,
      clientId,
      usersRaw,
      usersPurchased,
      startDateRaw: cellStr(startRaw),
      endDateRaw: cellStr(endRaw),
      startDate,
      endDate,
      parseErrors,
    };
  });
}

export function buildCrmAccountDateImportPlan(
  rawRows: CrmAccountDateImportRawRow[],
  accounts: CrmAccount[],
): CrmAccountDateImportPlan {
  const rows: CrmAccountDateImportPlanRow[] = [];
  let update = 0;
  let skip = 0;
  let error = 0;
  let notFound = 0;

  for (const raw of rawRows) {
    const key = `row-${raw.rowNumber}`;

    if (raw.parseErrors.length > 0) {
      error += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        usersPurchased: raw.usersPurchased,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "error",
        message: raw.parseErrors.join("; "),
      });
      continue;
    }

    if (!raw.clientId.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: "",
        usersPurchased: null,
        startDate: null,
        endDate: null,
        action: "skip",
        message: "Empty row skipped",
      });
      continue;
    }

    const existing = matchAccountByClientId(accounts, raw.clientId);
    if (!existing) {
      notFound += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        usersPurchased: raw.usersPurchased,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "not_found",
        message: `No account found with Client Id “${raw.clientId}”`,
      });
      continue;
    }

    const nextUsers =
      raw.usersPurchased != null ? Math.max(0, Math.round(raw.usersPurchased)) : null;
    const willChangeUsers =
      nextUsers != null && nextUsers !== (existing.usersPurchased ?? undefined);
    const willChangeStart = Boolean(raw.startDate && raw.startDate !== (existing.startDate ?? ""));
    const willChangeEnd = Boolean(raw.endDate && raw.endDate !== (existing.endDate ?? ""));

    if (!willChangeUsers && !willChangeStart && !willChangeEnd) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        usersPurchased: nextUsers,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "skip",
        existingId: existing.id,
        existingName: existing.name,
        previousUsers: existing.usersPurchased,
        previousStartDate: existing.startDate,
        previousEndDate: existing.endDate,
        message: "Users and dates already match — skipped",
      });
      continue;
    }

    update += 1;
    const notes: string[] = [`Update ${existing.name}`];
    if (willChangeUsers && nextUsers != null) {
      notes.push(`Users ${existing.usersPurchased ?? "—"} → ${nextUsers}`);
    }
    if (willChangeStart && raw.startDate) notes.push(`Start → ${raw.startDate}`);
    if (willChangeEnd && raw.endDate) notes.push(`End → ${raw.endDate}`);

    rows.push({
      rowNumber: raw.rowNumber,
      key,
      clientId: raw.clientId,
      usersPurchased: nextUsers,
      startDate: raw.startDate,
      endDate: raw.endDate,
      action: "update",
      existingId: existing.id,
      existingName: existing.name,
      previousUsers: existing.usersPurchased,
      previousStartDate: existing.startDate,
      previousEndDate: existing.endDate,
      applyUsers: willChangeUsers ? (nextUsers ?? undefined) : undefined,
      applyStartDate: willChangeStart ? (raw.startDate ?? undefined) : undefined,
      applyEndDate: willChangeEnd ? (raw.endDate ?? undefined) : undefined,
      message: notes.join(" · "),
    });
  }

  return {
    rows,
    summary: { update, skip, error, notFound },
  };
}
