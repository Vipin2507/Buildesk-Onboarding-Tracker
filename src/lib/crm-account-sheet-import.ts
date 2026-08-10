import * as XLSX from "xlsx";

import { findLocationByCity, regionForState } from "@/data/india-locations";
import { normalizeImportDate } from "@/lib/project-sheet-import";
import type { CrmAccount } from "@/types/crm-account";
import type { CompanyType } from "@/types/company";

/** Exact headers expected in the CRM accounts bulk upload template. */
export const CRM_ACCOUNT_IMPORT_HEADERS = [
  "S.No",
  "Client Id",
  "Company Name",
  "City",
  "State",
  "POC Name",
  "Number",
  "Email",
  "Users",
  "Deal Value",
  "Pending Amount",
  "Start Date",
  "End Date",
  "Sales Manager",
  "Support manager 1",
] as const;

export type CrmAccountImportHeader = (typeof CRM_ACCOUNT_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<CrmAccountImportHeader, string[]> = {
  "S.No": ["sno", "srno", "serialno", "serialnumber", "#"],
  "Client Id": ["clientid", "userid", "clinetid", "accountid", "client"],
  "Company Name": ["companyname", "accountname", "company", "account", "name"],
  City: ["city"],
  State: ["state"],
  "POC Name": ["pocname", "poc", "contact", "contactperson", "contactname"],
  Number: ["number", "phone", "mobile", "pocnumber", "pocmobile", "contactnumber"],
  Email: ["email", "pocemail", "mail"],
  Users: ["users", "userspurchased", "userpurchased", "licences", "licenses", "seats"],
  "Deal Value": ["dealvalue", "totaldealvalue", "dealsize", "totalcost", "value"],
  "Pending Amount": ["pendingamount", "pending", "balance"],
  "Start Date": ["startdate", "start", "fromdate"],
  "End Date": ["enddate", "end", "todate", "expiry"],
  "Sales Manager": ["salesmanager", "sales", "sm"],
  "Support manager 1": [
    "supportmanager1",
    "supportmanager",
    "support1",
    "supportmgr1",
    "csm",
  ],
};

export type CrmManagerOption = { id: string; name: string };

export type CrmAccountImportRawRow = {
  rowNumber: number;
  serialNo: string;
  clientId: string;
  companyName: string;
  city: string;
  state: string;
  pocName: string;
  number: string;
  email: string;
  users: string;
  dealValue: string;
  pendingAmount: string;
  startDateRaw: string;
  endDateRaw: string;
  salesManager: string;
  supportManager1: string;
  startDate: string | null;
  endDate: string | null;
  usersPurchased: number | null;
  dealSize: number | null;
  pending: number | null;
  parseErrors: string[];
};

export type CrmAccountImportPlanRow = {
  rowNumber: number;
  key: string;
  clientId: string;
  companyName: string;
  city: string;
  state: string;
  country: string;
  region: string;
  pocName: string;
  number: string;
  email: string;
  usersPurchased: number | null;
  dealSize: number | null;
  pendingAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  salesManagerRaw: string;
  supportManager1Raw: string;
  /** Resolved CRM user name, or "" if skipped / unresolved */
  salesManagerName: string;
  supportManager1Name: string;
  salesManagerNeedsPick: boolean;
  supportManager1NeedsPick: boolean;
  action: "create" | "update" | "skip" | "error";
  existingId?: string;
  message: string;
};

export type CrmAccountImportPlan = {
  rows: CrmAccountImportPlanRow[];
  summary: {
    create: number;
    update: number;
    skip: number;
    error: number;
    needsManagerPick: number;
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
  const raw = String(value).replace(/[,₹$]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapHeaders(keys: string[]) {
  const mapped: Partial<Record<CrmAccountImportHeader, string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of CRM_ACCOUNT_IMPORT_HEADERS) {
    const aliases = new Set([normKey(header), ...HEADER_ALIASES[header]]);
    const hit = normalized.find((k) => aliases.has(k.key));
    if (hit) mapped[header] = hit.raw;
  }

  return mapped;
}

export function normalizeManagerName(name: string) {
  return name
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Match sheet manager text to a CRM user.
 * Handles case differences and first-name-only cells when the match is unique.
 * Ambiguous matches (e.g. two users named Priya) return undefined for manual pick.
 */
export function matchCrmManager(
  raw: string,
  managers: CrmManagerOption[],
): CrmManagerOption | undefined {
  const needle = normalizeManagerName(raw);
  if (!needle) return undefined;

  const exact = managers.find((m) => normalizeManagerName(m.name) === needle);
  if (exact) return exact;

  const compact = (s: string) => s.replace(/\s+/g, "");
  const exactCompact = managers.filter(
    (m) => compact(normalizeManagerName(m.name)) === compact(needle),
  );
  if (exactCompact.length === 1) return exactCompact[0];

  const needleTokens = needle.split(" ").filter(Boolean);
  const first = needleTokens[0]!;

  // Excel often has only the first name (any casing).
  const byFirstName = managers.filter((m) => {
    const tokens = normalizeManagerName(m.name).split(" ").filter(Boolean);
    return tokens[0] === first;
  });
  if (needleTokens.length === 1) {
    if (byFirstName.length === 1) return byFirstName[0];
    return undefined;
  }

  // Partial full name: "priya sh" / "Priya Sharma" vs "Priya Sharma"
  const byTokenPrefix = managers.filter((m) => {
    const tokens = normalizeManagerName(m.name).split(" ").filter(Boolean);
    if (needleTokens.length > tokens.length) return false;
    return needleTokens.every(
      (t, i) => tokens[i] === t || (tokens[i]?.startsWith(t) ?? false),
    );
  });
  if (byTokenPrefix.length === 1) return byTokenPrefix[0];

  const starts = managers.filter((m) => normalizeManagerName(m.name).startsWith(needle));
  if (starts.length === 1) return starts[0];

  return undefined;
}

export function downloadCrmAccountImportTemplate() {
  const sample = [
    {
      "S.No": 1,
      "Client Id": "skyline-dev",
      "Company Name": "Skyline Developers",
      City: "Gurugram",
      State: "Haryana",
      "POC Name": "Sneha Verma",
      Number: "+91 98100 10002",
      Email: "sneha@skylinedev.in",
      Users: 40,
      "Deal Value": 850000,
      "Pending Amount": 350000,
      "Start Date": "2026-01-15",
      "End Date": "2027-01-14",
      "Sales Manager": "",
      "Support manager 1": "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, {
    header: [...CRM_ACCOUNT_IMPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accounts");
  XLSX.writeFile(wb, "crm_accounts_import_template.xlsx");
}

export async function parseCrmAccountImportFile(file: File): Promise<CrmAccountImportRawRow[]> {
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
  const required: CrmAccountImportHeader[] = ["Company Name"];
  const missing = required.filter((h) => !mapped[h]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Expected headers: ${CRM_ACCOUNT_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const serialNo = cellStr(row[mapped["S.No"] ?? ""]);
    const clientId = cellStr(row[mapped["Client Id"] ?? ""]);
    const companyName = cellStr(row[mapped["Company Name"]!]);
    const city = cellStr(row[mapped.City ?? ""]);
    const state = cellStr(row[mapped.State ?? ""]);
    const pocName = cellStr(row[mapped["POC Name"] ?? ""]);
    const number = cellStr(row[mapped.Number ?? ""]);
    const email = cellStr(row[mapped.Email ?? ""]);
    const usersRaw = row[mapped.Users ?? ""];
    const dealRaw = row[mapped["Deal Value"] ?? ""];
    const pendingRaw = row[mapped["Pending Amount"] ?? ""];
    const startRaw = row[mapped["Start Date"] ?? ""];
    const endRaw = row[mapped["End Date"] ?? ""];
    const salesManager = cellStr(row[mapped["Sales Manager"] ?? ""]);
    const supportManager1 = cellStr(row[mapped["Support manager 1"] ?? ""]);

    const startDate = normalizeImportDate(startRaw);
    const endDate = normalizeImportDate(endRaw);
    const usersPurchased = parseNumber(usersRaw);
    const dealSize = parseNumber(dealRaw);
    const pending = parseNumber(pendingRaw);
    const parseErrors: string[] = [];

    if (!companyName) parseErrors.push("Company Name is required");
    if (cellStr(usersRaw) && usersPurchased == null) parseErrors.push(`Invalid Users: ${cellStr(usersRaw)}`);
    if (cellStr(dealRaw) && dealSize == null) parseErrors.push(`Invalid Deal Value: ${cellStr(dealRaw)}`);
    if (cellStr(pendingRaw) && pending == null) {
      parseErrors.push(`Invalid Pending Amount: ${cellStr(pendingRaw)}`);
    }
    if (cellStr(startRaw) && !startDate) parseErrors.push(`Invalid Start Date: ${cellStr(startRaw)}`);
    if (cellStr(endRaw) && !endDate) parseErrors.push(`Invalid End Date: ${cellStr(endRaw)}`);

    return {
      rowNumber: i + 2,
      serialNo,
      clientId,
      companyName,
      city,
      state,
      pocName,
      number,
      email,
      users: cellStr(usersRaw),
      dealValue: cellStr(dealRaw),
      pendingAmount: cellStr(pendingRaw),
      startDateRaw: cellStr(startRaw),
      endDateRaw: cellStr(endRaw),
      salesManager,
      supportManager1,
      startDate,
      endDate,
      usersPurchased,
      dealSize,
      pending,
      parseErrors,
    };
  });
}

export function buildCrmAccountImportPlan(
  rawRows: CrmAccountImportRawRow[],
  accounts: CrmAccount[],
  managers: CrmManagerOption[],
  overrides?: Record<string, { salesManagerName?: string; supportManager1Name?: string }>,
): CrmAccountImportPlan {
  const byUserId = new Map(
    accounts
      .filter((a) => a.userId?.trim())
      .map((a) => [normalizeManagerName(a.userId!), a] as const),
  );
  const byName = new Map(accounts.map((a) => [normalizeManagerName(a.name), a] as const));

  const rows: CrmAccountImportPlanRow[] = [];
  let create = 0;
  let update = 0;
  let skip = 0;
  let error = 0;
  let needsManagerPick = 0;

  for (const raw of rawRows) {
    const key = `row-${raw.rowNumber}`;
    const override = overrides?.[key];

    if (raw.parseErrors.length > 0) {
      error += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        companyName: raw.companyName,
        city: raw.city,
        state: raw.state,
        country: "India",
        region: "Rest of India",
        pocName: raw.pocName,
        number: raw.number,
        email: raw.email,
        usersPurchased: raw.usersPurchased,
        dealSize: raw.dealSize,
        pendingAmount: raw.pending,
        startDate: raw.startDate,
        endDate: raw.endDate,
        salesManagerRaw: raw.salesManager,
        supportManager1Raw: raw.supportManager1,
        salesManagerName: "",
        supportManager1Name: "",
        salesManagerNeedsPick: false,
        supportManager1NeedsPick: false,
        action: "error",
        message: raw.parseErrors.join("; "),
      });
      continue;
    }

    if (!raw.companyName.trim() && !raw.clientId.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: "",
        companyName: "",
        city: "",
        state: "",
        country: "",
        region: "",
        pocName: "",
        number: "",
        email: "",
        usersPurchased: null,
        dealSize: null,
        pendingAmount: null,
        startDate: null,
        endDate: null,
        salesManagerRaw: "",
        supportManager1Raw: "",
        salesManagerName: "",
        supportManager1Name: "",
        salesManagerNeedsPick: false,
        supportManager1NeedsPick: false,
        action: "skip",
        message: "Empty row skipped",
      });
      continue;
    }

    const existing =
      (raw.clientId ? byUserId.get(normalizeManagerName(raw.clientId)) : undefined) ??
      byName.get(normalizeManagerName(raw.companyName));

    const loc = findLocationByCity(raw.city);
    const state = raw.state || loc?.state || existing?.state || "";
    const country = loc?.country || existing?.country || "India";
    const region =
      loc?.region ||
      (state ? regionForState(state) : undefined) ||
      existing?.region ||
      "Rest of India";

    let salesManagerName = "";
    let salesManagerNeedsPick = false;
    if (override?.salesManagerName !== undefined) {
      salesManagerName = override.salesManagerName;
      salesManagerNeedsPick = false;
    } else if (!raw.salesManager.trim()) {
      salesManagerName = "";
      salesManagerNeedsPick = false;
    } else {
      const hit = matchCrmManager(raw.salesManager, managers);
      if (hit) {
        salesManagerName = hit.name;
      } else {
        salesManagerNeedsPick = true;
        salesManagerName = "";
      }
    }

    let supportManager1Name = "";
    let supportManager1NeedsPick = false;
    if (override?.supportManager1Name !== undefined) {
      supportManager1Name = override.supportManager1Name;
      supportManager1NeedsPick = false;
    } else if (!raw.supportManager1.trim()) {
      supportManager1Name = "";
      supportManager1NeedsPick = false;
    } else {
      const hit = matchCrmManager(raw.supportManager1, managers);
      if (hit) {
        supportManager1Name = hit.name;
      } else {
        supportManager1NeedsPick = true;
        supportManager1Name = "";
      }
    }

    if (salesManagerNeedsPick || supportManager1NeedsPick) needsManagerPick += 1;

    const action = existing ? "update" : "create";
    if (action === "create") create += 1;
    else update += 1;

    const notes: string[] = [];
    if (action === "create") notes.push("New account");
    else notes.push(`Update ${existing!.name}`);
    if (salesManagerNeedsPick) notes.push(`Sales manager “${raw.salesManager}” not found — pick manually`);
    if (supportManager1NeedsPick) {
      notes.push(`Support manager “${raw.supportManager1}” not found — pick manually`);
    }
    if (!raw.salesManager.trim()) notes.push("Sales manager blank (skipped)");
    if (!raw.supportManager1.trim()) notes.push("Support manager blank (skipped)");

    rows.push({
      rowNumber: raw.rowNumber,
      key,
      clientId: raw.clientId,
      companyName: raw.companyName.trim().replace(/\s+/g, " "),
      city: raw.city,
      state,
      country,
      region,
      pocName: raw.pocName,
      number: raw.number,
      email: raw.email,
      usersPurchased: raw.usersPurchased,
      dealSize: raw.dealSize,
      pendingAmount: raw.pending,
      startDate: raw.startDate,
      endDate: raw.endDate,
      salesManagerRaw: raw.salesManager,
      supportManager1Raw: raw.supportManager1,
      salesManagerName,
      supportManager1Name,
      salesManagerNeedsPick,
      supportManager1NeedsPick,
      action,
      existingId: existing?.id,
      message: notes.join(" · "),
    });
  }

  return {
    rows,
    summary: { create, update, skip, error, needsManagerPick },
  };
}

/** Apply non-empty sheet values onto an account draft; empty cells are skipped. */
export function mergeCrmAccountImportRow(
  row: CrmAccountImportPlanRow,
  existing?: CrmAccount,
): Omit<CrmAccount, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  const base = existing
    ? { ...existing }
    : {
        name: row.companyName,
        companyType: "Real Estate Developer" as CompanyType,
        contact: row.pocName || "To be assigned",
        phone: row.number || "—",
        email: row.email || "pending@buildesk.local",
        city: row.city || "—",
        status: "onboarding" as const,
        annualLicense: true,
      };

  const next: Omit<CrmAccount, "id" | "createdAt" | "updatedAt"> & { id?: string } = {
    ...base,
    id: existing?.id,
    name: row.companyName || base.name,
    status: existing?.status ?? "onboarding",
    companyType: existing?.companyType ?? "Real Estate Developer",
  };

  if (row.clientId) next.userId = row.clientId;
  if (row.city) {
    next.city = row.city;
    if (row.state) next.state = row.state;
    if (row.country) next.country = row.country;
    if (row.region) next.region = row.region;
  } else if (row.state) {
    next.state = row.state;
    if (row.country) next.country = row.country;
    if (row.region) next.region = row.region;
  }

  if (row.pocName) {
    next.pocName = row.pocName;
    if (!existing?.contact || existing.contact === "To be assigned") next.contact = row.pocName;
  }
  if (row.number) {
    next.pocMobile = row.number;
    next.phone = row.number;
    if (!existing?.ownerPhone) next.ownerPhone = row.number;
  }
  if (row.email) {
    next.pocEmail = row.email;
    next.email = row.email;
    if (!existing?.ownerEmail) next.ownerEmail = row.email;
  }
  if (row.usersPurchased != null) next.usersPurchased = Math.max(0, Math.round(row.usersPurchased));
  if (row.dealSize != null) {
    next.dealSize = row.dealSize;
    next.totalCost = row.dealSize;
  }
  if (row.pendingAmount != null) {
    next.pendingAmount = row.pendingAmount;
    const deal = next.dealSize ?? next.totalCost ?? 0;
    next.paymentReceived = Math.max(0, deal - row.pendingAmount);
  }
  if (row.startDate) next.startDate = row.startDate;
  if (row.endDate) next.endDate = row.endDate;

  // Only set managers when resolved (matched or manually picked). Never invent a random one.
  if (row.salesManagerName) next.salesManagerName = row.salesManagerName;
  if (row.supportManager1Name) next.supportManager1 = row.supportManager1Name;

  if (!next.ownerName) next.ownerName = next.pocName || next.contact;
  if (!next.pocName) next.pocName = next.contact;
  if (!next.pocMobile) next.pocMobile = next.phone;

  return next;
}
