import * as XLSX from "xlsx";

import type { Company, Project } from "@/types";

export const PROJECT_IMPORT_HEADERS = [
  "Project",
  "ProjectCreatedAt",
  "Company",
  "CompanyCreatedAt",
] as const;

export type ProjectImportRawRow = {
  rowNumber: number;
  projectName: string;
  projectStartDate: string | null;
  companyName: string;
  companyStartDate: string | null;
  errors: string[];
};

export type ProjectImportAction =
  | { kind: "create_company"; companyName: string; startDate: string }
  | { kind: "update_company"; companyId: string; companyName: string; startDate: string }
  | { kind: "create_project"; projectName: string; companyName: string; startDate: string }
  | {
      kind: "update_project";
      projectId: string;
      projectName: string;
      companyName: string;
      startDate: string;
    };

export type ProjectImportPlanRow = {
  rowNumber: number;
  projectName: string;
  companyName: string;
  projectStartDate: string | null;
  companyStartDate: string | null;
  status: "ready" | "error" | "skip";
  message: string;
  actions: ProjectImportAction[];
};

export type ProjectImportPlan = {
  rows: ProjectImportPlanRow[];
  summary: {
    ready: number;
    errors: number;
    skips: number;
    companiesToCreate: number;
    companiesToUpdate: number;
    projectsToCreate: number;
    projectsToUpdate: number;
  };
};

function normKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-]+/g, "");
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Normalize spreadsheet dates to YYYY-MM-DD. */
function expandYear(yRaw: number): number {
  return yRaw < 100 ? 2000 + yRaw : yRaw;
}

function normalizeDateText(value: unknown): string {
  return String(value)
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** True when a sheet date cell is intentionally blank (-, NA, empty, etc.). */
export function isEmptyImportDateValue(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (value instanceof Date) return false;
  if (typeof value === "number" && Number.isFinite(value)) return false;
  const raw = normalizeDateText(value).toLowerCase();
  if (!raw) return true;
  if (/^[-–—./\\]+$/.test(raw)) return true;
  if (raw === "na" || raw === "n/a" || raw === "nil" || raw === "none" || raw === "tbd") {
    return true;
  }
  return false;
}

export function normalizeImportDate(value: unknown): string | null {
  if (isEmptyImportDateValue(value)) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toYmd(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + value * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return null;
  }

  const raw = normalizeDateText(value);
  if (!raw) return null;

  const ymdFromParts = (day: number, monthIndex: number, year: number) => {
    const y = expandYear(year);
    if (monthIndex < 0 || !validYmd(y, monthIndex + 1, day)) return null;
    return `${y}-${pad(monthIndex + 1)}-${pad(day)}`;
  };

  const dMonY = raw.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,12})[-/\s]+(\d{2,4})$/i);
  if (dMonY) {
    const hit = ymdFromParts(Number(dMonY[1]), parseMonthToken(dMonY[2]!) ?? -1, Number(dMonY[3]));
    if (hit) return hit;
  }

  const monD = raw.match(/^([A-Za-z]{3,12})[-/\s]+(\d{1,2})(?:[,/-]\s*|\s+)(\d{2,4})$/i);
  if (monD) {
    const mon = parseMonthToken(monD[1]!);
    if (mon != null) {
      const hit = ymdFromParts(Number(monD[2]), mon, Number(monD[3]));
      if (hit) return hit;
    }
  }

  const dMonYSpaced = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,12})\s+(\d{2,4})$/i);
  if (dMonYSpaced) {
    const hit = ymdFromParts(
      Number(dMonYSpaced[1]),
      parseMonthToken(dMonYSpaced[2]!) ?? -1,
      Number(dMonYSpaced[3]),
    );
    if (hit) return hit;
  }

  // Already ISO / YYYY-MM-DD (optional time suffix)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const day = Number(iso[3]);
    if (validYmd(y, m, day)) return `${y}-${pad(m)}-${pad(day)}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in India sheets)
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = expandYear(Number(dmy[3]));
    if (validYmd(y, m, day)) return `${y}-${pad(m)}-${pad(day)}`;
  }

  // MM/DD/YYYY when day > 12
  const mdy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (mdy) {
    const m = Number(mdy[1]);
    const day = Number(mdy[2]);
    const y = expandYear(Number(mdy[3]));
    if (day > 12 && m <= 12 && validYmd(y, m, day)) {
      return `${y}-${pad(m)}-${pad(day)}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toYmd(parsed);

  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseMonthToken(value: string): number | null {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return null;

  const aliases: string[][] = [
    ["jan", "january"],
    ["feb", "february"],
    ["mar", "march"],
    ["apr", "april"],
    ["may"],
    ["jun", "june"],
    ["jul", "july"],
    ["aug", "august"],
    ["sep", "sept", "september"],
    ["oct", "october"],
    ["nov", "november"],
    ["dec", "december"],
  ];

  for (let i = 0; i < aliases.length; i++) {
    if (aliases[i]!.some((alias) => cleaned === alias || cleaned.startsWith(alias))) {
      return i;
    }
  }

  return null;
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validYmd(y: number, m: number, day: number) {
  if (m < 1 || m > 12 || day < 1 || day > 31 || y < 1900 || y > 2100) return false;
  const d = new Date(y, m - 1, day);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

export function normalizeEntityName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const HEADER_ALIASES: Record<(typeof PROJECT_IMPORT_HEADERS)[number], string[]> = {
  Project: ["project", "projectname", "projecttitle"],
  ProjectCreatedAt: [
    "projectcreatedat",
    "projectstartdate",
    "projectstart",
    "projectcreated",
  ],
  Company: ["company", "companyname", "client", "clientname"],
  CompanyCreatedAt: [
    "companycreatedat",
    "companystartdate",
    "companystart",
    "companycreated",
  ],
};

function mapHeaders(keys: string[]) {
  const mapped: Partial<Record<(typeof PROJECT_IMPORT_HEADERS)[number], string>> = {};
  const normalized = keys.map((k) => ({ raw: k, key: normKey(k) }));

  for (const header of PROJECT_IMPORT_HEADERS) {
    const aliases = new Set([normKey(header), ...HEADER_ALIASES[header]]);
    const hit = normalized.find((k) => aliases.has(k.key));
    if (hit) mapped[header] = hit.raw;
  }

  return mapped;
}

export async function parseProjectImportFile(file: File): Promise<ProjectImportRawRow[]> {
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
  const missing = PROJECT_IMPORT_HEADERS.filter((h) => !mapped[h]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Expected: ${PROJECT_IMPORT_HEADERS.join(", ")}`,
    );
  }

  return json.map((row, i) => {
    const projectName = cellStr(row[mapped.Project!]);
    const companyName = cellStr(row[mapped.Company!]);
    const projectRaw = row[mapped.ProjectCreatedAt!];
    const companyRaw = row[mapped.CompanyCreatedAt!];
    const projectStartDate = normalizeImportDate(projectRaw);
    const companyStartDate = normalizeImportDate(companyRaw);
    const errors: string[] = [];

    if (!projectName) errors.push("Project name is required");
    if (!companyName) errors.push("Company name is required");
    if (cellStr(projectRaw) && !projectStartDate) {
      errors.push(`Invalid ProjectCreatedAt: ${cellStr(projectRaw)}`);
    }
    if (cellStr(companyRaw) && !companyStartDate) {
      errors.push(`Invalid CompanyCreatedAt: ${cellStr(companyRaw)}`);
    }

    return {
      rowNumber: i + 2, // header is row 1
      projectName,
      projectStartDate,
      companyName,
      companyStartDate,
      errors,
    };
  });
}

export function buildProjectImportPlan(
  rawRows: ProjectImportRawRow[],
  companies: Company[],
  projects: Project[],
): ProjectImportPlan {
  const companyByName = new Map(
    companies.map((c) => [normalizeEntityName(c.name), c] as const),
  );
  const projectsByCompany = new Map<string, Project[]>();
  for (const p of projects) {
    const list = projectsByCompany.get(p.companyId) ?? [];
    list.push(p);
    projectsByCompany.set(p.companyId, list);
  }

  /** Companies created earlier in this plan (name → provisional). */
  const pendingCompanies = new Map<string, { startDate: string }>();
  const pendingProjects = new Set<string>(); // companyName|projectName

  const rows: ProjectImportPlanRow[] = [];
  let companiesToCreate = 0;
  let companiesToUpdate = 0;
  let projectsToCreate = 0;
  let projectsToUpdate = 0;

  for (const raw of rawRows) {
    if (raw.errors.length > 0) {
      rows.push({
        rowNumber: raw.rowNumber,
        projectName: raw.projectName,
        companyName: raw.companyName,
        projectStartDate: raw.projectStartDate,
        companyStartDate: raw.companyStartDate,
        status: "error",
        message: raw.errors.join("; "),
        actions: [],
      });
      continue;
    }

    const cKey = normalizeEntityName(raw.companyName);
    const pKey = `${cKey}|${normalizeEntityName(raw.projectName)}`;
    const actions: ProjectImportAction[] = [];
    const notes: string[] = [];

    const existingCompany = companyByName.get(cKey);
    const companyStart =
      raw.companyStartDate ||
      existingCompany?.startDate ||
      existingCompany?.agreementDate ||
      new Date().toISOString().slice(0, 10);

    if (!existingCompany && !pendingCompanies.has(cKey)) {
      actions.push({
        kind: "create_company",
        companyName: raw.companyName.trim().replace(/\s+/g, " "),
        startDate: companyStart,
      });
      pendingCompanies.set(cKey, { startDate: companyStart });
      companiesToCreate += 1;
      notes.push("New company");
    } else if (existingCompany && raw.companyStartDate && existingCompany.startDate !== raw.companyStartDate) {
      actions.push({
        kind: "update_company",
        companyId: existingCompany.id,
        companyName: existingCompany.name,
        startDate: raw.companyStartDate,
      });
      companiesToUpdate += 1;
      notes.push("Update company start");
    } else if (!existingCompany && pendingCompanies.has(cKey)) {
      notes.push("Use company from earlier row");
    }

    const companyId = existingCompany?.id;
    const companyProjects = companyId ? (projectsByCompany.get(companyId) ?? []) : [];
    const existingProject = companyProjects.find(
      (p) => normalizeEntityName(p.name) === normalizeEntityName(raw.projectName),
    );

    const projectStart =
      raw.projectStartDate || existingProject?.startDate || companyStart;

    if (existingProject) {
      if (raw.projectStartDate && existingProject.startDate !== raw.projectStartDate) {
        actions.push({
          kind: "update_project",
          projectId: existingProject.id,
          projectName: existingProject.name,
          companyName: raw.companyName.trim().replace(/\s+/g, " "),
          startDate: raw.projectStartDate,
        });
        projectsToUpdate += 1;
        notes.push("Update project start");
      } else if (!raw.projectStartDate || existingProject.startDate === raw.projectStartDate) {
        // nothing to change for project
        if (actions.length === 0) {
          rows.push({
            rowNumber: raw.rowNumber,
            projectName: raw.projectName,
            companyName: raw.companyName,
            projectStartDate: raw.projectStartDate,
            companyStartDate: raw.companyStartDate,
            status: "skip",
            message: "Already imported — no changes",
            actions: [],
          });
          continue;
        }
      }
    } else if (pendingProjects.has(pKey)) {
      if (actions.length === 0) {
        rows.push({
          rowNumber: raw.rowNumber,
          projectName: raw.projectName,
          companyName: raw.companyName,
          projectStartDate: raw.projectStartDate,
          companyStartDate: raw.companyStartDate,
          status: "skip",
          message: "Duplicate row in sheet",
          actions: [],
        });
        continue;
      }
      notes.push("Duplicate project in sheet");
    } else {
      actions.push({
        kind: "create_project",
        projectName: raw.projectName.trim().replace(/\s+/g, " "),
        companyName: raw.companyName.trim().replace(/\s+/g, " "),
        startDate: projectStart,
      });
      pendingProjects.add(pKey);
      projectsToCreate += 1;
      notes.push("New project");
    }

    if (actions.length === 0) {
      rows.push({
        rowNumber: raw.rowNumber,
        projectName: raw.projectName,
        companyName: raw.companyName,
        projectStartDate: raw.projectStartDate,
        companyStartDate: raw.companyStartDate,
        status: "skip",
        message: "Already up to date",
        actions: [],
      });
      continue;
    }

    rows.push({
      rowNumber: raw.rowNumber,
      projectName: raw.projectName.trim().replace(/\s+/g, " "),
      companyName: raw.companyName.trim().replace(/\s+/g, " "),
      projectStartDate: raw.projectStartDate,
      companyStartDate: raw.companyStartDate,
      status: "ready",
      message: notes.join(" · "),
      actions,
    });
  }

  return {
    rows,
    summary: {
      ready: rows.filter((r) => r.status === "ready").length,
      errors: rows.filter((r) => r.status === "error").length,
      skips: rows.filter((r) => r.status === "skip").length,
      companiesToCreate,
      companiesToUpdate,
      projectsToCreate,
      projectsToUpdate,
    },
  };
}

export function downloadProjectImportSample() {
  const csv = [
    PROJECT_IMPORT_HEADERS.join(","),
    "Horizon Towers,2024-03-15,Globe Group,2024-01-10",
    "Park Avenue,15/04/2024,Globe Group,2024-01-10",
    "Sky Villas,2024-06-01,Neelam Realtors,2023-11-20",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "project_company_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function companyEmailFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return `contact@${slug || "client"}.example`;
}
