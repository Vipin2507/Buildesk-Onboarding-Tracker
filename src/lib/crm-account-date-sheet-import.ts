import * as XLSX from "xlsx";

import { normalizeManagerName } from "@/lib/crm-account-sheet-import";
import { normalizeImportDate } from "@/lib/project-sheet-import";
import type { CrmAccount } from "@/types/crm-account";

export const CRM_ACCOUNT_DATE_IMPORT_HEADERS = [
  "S.No",
  "Client Id",
  "Company Name",
  "Start Date",
  "End Date",
] as const;

type DateImportHeader = (typeof CRM_ACCOUNT_DATE_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<DateImportHeader, string[]> = {
  "S.No": ["sno", "srno", "serialno", "serialnumber", "#"],
  "Client Id": ["clientid", "userid", "clinetid", "accountid", "client"],
  "Company Name": ["companyname", "accountname", "company", "account", "name"],
  "Start Date": ["startdate", "start", "fromdate"],
  "End Date": ["enddate", "end", "todate", "expiry"],
};

export type CrmAccountDateImportRawRow = {
  rowNumber: number;
  serialNo: string;
  clientId: string;
  companyName: string;
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
  companyName: string;
  startDate: string | null;
  endDate: string | null;
  action: "update" | "skip" | "error" | "not_found";
  existingId?: string;
  existingName?: string;
  previousStartDate?: string;
  previousEndDate?: string;
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
      "Client Id": "skyline-dev",
      "Company Name": "Skyline Developers",
      "Start Date": "2026-01-15",
      "End Date": "2027-01-14",
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
    const companyName = cellStr(row[mapped["Company Name"] ?? ""]);
    const startRaw = row[mapped["Start Date"] ?? ""];
    const endRaw = row[mapped["End Date"] ?? ""];

    const startDate = normalizeImportDate(startRaw);
    const endDate = normalizeImportDate(endRaw);
    const parseErrors: string[] = [];

    if (!clientId.trim()) parseErrors.push("Client Id is required");
    if (!cellStr(startRaw) && !cellStr(endRaw)) {
      parseErrors.push("At least one of Start Date or End Date is required");
    }
    if (cellStr(startRaw) && !startDate) parseErrors.push(`Invalid Start Date: ${cellStr(startRaw)}`);
    if (cellStr(endRaw) && !endDate) parseErrors.push(`Invalid End Date: ${cellStr(endRaw)}`);

    return {
      rowNumber: i + 2,
      serialNo,
      clientId,
      companyName,
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
        companyName: raw.companyName,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "error",
        message: raw.parseErrors.join("; "),
      });
      continue;
    }

    if (!raw.clientId.trim() && !raw.companyName.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: "",
        companyName: "",
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
        companyName: raw.companyName,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "not_found",
        message: `No account found with Client Id “${raw.clientId}”`,
      });
      continue;
    }

    const willChangeStart = Boolean(raw.startDate && raw.startDate !== (existing.startDate ?? ""));
    const willChangeEnd = Boolean(raw.endDate && raw.endDate !== (existing.endDate ?? ""));

    if (!willChangeStart && !willChangeEnd) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        companyName: raw.companyName || existing.name,
        startDate: raw.startDate,
        endDate: raw.endDate,
        action: "skip",
        existingId: existing.id,
        existingName: existing.name,
        previousStartDate: existing.startDate,
        previousEndDate: existing.endDate,
        message: "Dates already match — skipped",
      });
      continue;
    }

    update += 1;
    const notes: string[] = [`Update ${existing.name}`];
    if (willChangeStart && raw.startDate) notes.push(`Start → ${raw.startDate}`);
    if (willChangeEnd && raw.endDate) notes.push(`End → ${raw.endDate}`);
    if (raw.companyName && normalizeManagerName(raw.companyName) !== normalizeManagerName(existing.name)) {
      notes.push(`Sheet company “${raw.companyName}” differs from account “${existing.name}”`);
    }

    rows.push({
      rowNumber: raw.rowNumber,
      key,
      clientId: raw.clientId,
      companyName: raw.companyName || existing.name,
      startDate: raw.startDate,
      endDate: raw.endDate,
      action: "update",
      existingId: existing.id,
      existingName: existing.name,
      previousStartDate: existing.startDate,
      previousEndDate: existing.endDate,
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