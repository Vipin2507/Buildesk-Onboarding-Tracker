import * as XLSX from "xlsx";

import { isValidPortalSlug, normalizePortalSlug } from "@/lib/design-ticket-portal";
import { normalizeManagerName } from "@/lib/crm-account-sheet-import";
import type { CrmAccount } from "@/types/crm-account";
import type { CompanyPortalAccess } from "@/types/design-ticket";

export const CRM_ACCOUNT_API_KEY_IMPORT_HEADERS = ["Client ID", "API"] as const;

type ApiKeyImportHeader = (typeof CRM_ACCOUNT_API_KEY_IMPORT_HEADERS)[number];

const HEADER_ALIASES: Record<ApiKeyImportHeader, string[]> = {
  "Client ID": ["clientid", "client id", "userid", "user id", "clinetid", "accountid", "client"],
  API: ["api", "apikey", "api key", "portalapikey", "portal api key", "portalkey", "slug"],
};

export type CrmAccountApiKeyImportRawRow = {
  rowNumber: number;
  clientId: string;
  apiRaw: string;
  apiSlug: string;
  parseErrors: string[];
};

export type CrmAccountApiKeyImportPlanRow = {
  rowNumber: number;
  key: string;
  clientId: string;
  apiRaw: string;
  apiSlug: string;
  action: "update" | "skip" | "error" | "not_found";
  existingId?: string;
  existingName?: string;
  previousSlug?: string;
  message: string;
};

export type CrmAccountApiKeyImportPlan = {
  rows: CrmAccountApiKeyImportPlanRow[];
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
  const mapped: Partial<Record<ApiKeyImportHeader, string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of CRM_ACCOUNT_API_KEY_IMPORT_HEADERS) {
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

  if (hits.length >= 1) return hits[0];
  return undefined;
}

export function downloadCrmAccountApiKeyImportTemplate() {
  const sample = [
    {
      "Client ID": "skyline-dev",
      API: "skyline-portal",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, {
    header: [...CRM_ACCOUNT_API_KEY_IMPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "API Keys");
  XLSX.writeFile(wb, "crm_account_api_keys_update_template.xlsx");
}

export async function parseCrmAccountApiKeyImportFile(
  file: File,
): Promise<CrmAccountApiKeyImportRawRow[]> {
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
  if (!mapped["Client ID"] || !mapped.API) {
    throw new Error(
      `Missing required columns. Expected headers: ${CRM_ACCOUNT_API_KEY_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const clientId = cellStr(row[mapped["Client ID"]!]);
    const apiRaw = cellStr(row[mapped.API!]);
    const apiSlug = normalizePortalSlug(apiRaw);
    const parseErrors: string[] = [];

    if (!clientId.trim()) parseErrors.push("Client ID is required");
    if (!apiRaw.trim()) parseErrors.push("API is required");
    else if (!apiSlug) parseErrors.push("API is empty after normalization");
    else if (!isValidPortalSlug(apiSlug)) {
      parseErrors.push(
        "API must be 3–48 characters (letters, numbers, hyphens) after normalization",
      );
    }

    return {
      rowNumber: i + 2,
      clientId,
      apiRaw,
      apiSlug,
      parseErrors,
    };
  });
}

export function buildCrmAccountApiKeyImportPlan(
  rawRows: CrmAccountApiKeyImportRawRow[],
  accounts: CrmAccount[],
  portals: CompanyPortalAccess[],
): CrmAccountApiKeyImportPlan {
  const rows: CrmAccountApiKeyImportPlanRow[] = [];
  let update = 0;
  let skip = 0;
  let error = 0;
  let notFound = 0;

  const slugToAccountId = new Map<string, string>();
  for (const portal of portals) {
    slugToAccountId.set(portal.slug, portal.companyId);
  }

  const sheetSlugOwners = new Map<string, number>();

  for (const raw of rawRows) {
    const key = `row-${raw.rowNumber}`;

    if (raw.parseErrors.length > 0) {
      error += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        apiRaw: raw.apiRaw,
        apiSlug: raw.apiSlug,
        action: "error",
        message: raw.parseErrors.join("; "),
      });
      continue;
    }

    if (!raw.clientId.trim() && !raw.apiRaw.trim()) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: "",
        apiRaw: "",
        apiSlug: "",
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
        apiRaw: raw.apiRaw,
        apiSlug: raw.apiSlug,
        action: "not_found",
        message: `No account found with Client ID “${raw.clientId}”`,
      });
      continue;
    }

    const priorSheetRow = sheetSlugOwners.get(raw.apiSlug);
    if (priorSheetRow != null) {
      error += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        apiRaw: raw.apiRaw,
        apiSlug: raw.apiSlug,
        action: "error",
        existingId: existing.id,
        existingName: existing.name,
        message: `Duplicate API “${raw.apiSlug}” in sheet (also on row ${priorSheetRow})`,
      });
      continue;
    }
    sheetSlugOwners.set(raw.apiSlug, raw.rowNumber);

    const portal = portals.find((p) => p.companyId === existing.id);
    const previousSlug = portal?.slug;
    const slugOwner = slugToAccountId.get(raw.apiSlug);
    if (slugOwner && slugOwner !== existing.id) {
      error += 1;
      const other = accounts.find((a) => a.id === slugOwner);
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        apiRaw: raw.apiRaw,
        apiSlug: raw.apiSlug,
        action: "error",
        existingId: existing.id,
        existingName: existing.name,
        previousSlug,
        message: `API “${raw.apiSlug}” is already used by ${other?.name ?? "another account"}`,
      });
      continue;
    }

    if (previousSlug === raw.apiSlug) {
      skip += 1;
      rows.push({
        rowNumber: raw.rowNumber,
        key,
        clientId: raw.clientId,
        apiRaw: raw.apiRaw,
        apiSlug: raw.apiSlug,
        action: "skip",
        existingId: existing.id,
        existingName: existing.name,
        previousSlug,
        message: "API key already matches — skipped",
      });
      continue;
    }

    update += 1;
    rows.push({
      rowNumber: raw.rowNumber,
      key,
      clientId: raw.clientId,
      apiRaw: raw.apiRaw,
      apiSlug: raw.apiSlug,
      action: "update",
      existingId: existing.id,
      existingName: existing.name,
      previousSlug,
      message: previousSlug
        ? `Update ${existing.name}: ${previousSlug} → ${raw.apiSlug}`
        : `Set portal API for ${existing.name} → ${raw.apiSlug}`,
    });
  }

  return {
    rows,
    summary: { update, skip, error, notFound },
  };
}
