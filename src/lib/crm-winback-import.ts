/** Parse a CSV sheet with CompanyName, ContactPerson, Mobile (+ optional Email, City). */

export type WinbackImportRow = {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  city?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const COMPANY_KEYS = new Set(["companyname", "company", "accountname", "account"]);
const CONTACT_KEYS = new Set(["contactperson", "contact", "name", "person"]);
const MOBILE_KEYS = new Set(["mobile", "phone", "phonenumber", "whatsapp"]);
const EMAIL_KEYS = new Set(["email", "mail"]);
const CITY_KEYS = new Set(["city", "location"]);

export function parseWinbackCsv(text: string): { rows: WinbackImportRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], errors: ["File needs a header row and at least one contact"] };
  }

  const headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  const companyIdx = headers.findIndex((h) => COMPANY_KEYS.has(h));
  const contactIdx = headers.findIndex((h) => CONTACT_KEYS.has(h));
  const mobileIdx = headers.findIndex((h) => MOBILE_KEYS.has(h));
  const emailIdx = headers.findIndex((h) => EMAIL_KEYS.has(h));
  const cityIdx = headers.findIndex((h) => CITY_KEYS.has(h));

  if (companyIdx < 0 || mobileIdx < 0) {
    return {
      rows: [],
      errors: ["Header must include CompanyName and Mobile (ContactPerson optional)"],
    };
  }

  const rows: WinbackImportRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const companyName = (cols[companyIdx] ?? "").trim();
    const mobile = (cols[mobileIdx] ?? "").trim();
    if (!companyName && !mobile) continue;
    if (!companyName || !mobile) {
      if (errors.length < 25) errors.push(`Row ${i + 1}: company and mobile are required`);
      continue;
    }
    rows.push({
      companyName,
      contactPerson: contactIdx >= 0 ? (cols[contactIdx] ?? "").trim() : "",
      mobile,
      email: emailIdx >= 0 ? (cols[emailIdx] ?? "").trim() || undefined : undefined,
      city: cityIdx >= 0 ? (cols[cityIdx] ?? "").trim() || undefined : undefined,
    });
  }
  return { rows, errors };
}
