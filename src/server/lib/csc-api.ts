const CSC_BASE_URL = "https://api.countrystatecity.in/v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

export type CscCountry = { iso2: string; name: string };
export type CscState = { iso2: string; name: string };
export type CscCity = { name: string };

function resolveCscApiKey(): string {
  const raw = process.env.CSC_API_KEY?.trim();
  if (!raw) {
    throw new Error("Location lookup is not configured. Set CSC_API_KEY in the server environment.");
  }
  return raw;
}

async function cscFetch<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const res = await fetch(`${CSC_BASE_URL}${path}`, {
    headers: { "X-CSCAPI-KEY": resolveCscApiKey() },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Location API request failed (${res.status})${body ? `: ${body.slice(0, 160)}` : ""}`,
    );
  }

  const data = (await res.json()) as T;
  cache.set(path, { at: Date.now(), data });
  return data;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function fetchCscCountries(): Promise<CscCountry[]> {
  const rows = await cscFetch<unknown[]>("/countries");
  return rows
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const iso2 = readString(record, "iso2");
      const name = readString(record, "name");
      if (!iso2 || !name) return null;
      return { iso2, name };
    })
    .filter((row): row is CscCountry => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCscStates(countryCode: string): Promise<CscState[]> {
  const code = countryCode.trim().toUpperCase();
  if (!code) return [];
  const rows = await cscFetch<unknown[]>(`/countries/${encodeURIComponent(code)}/states`);
  return rows
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const iso2 = readString(record, "iso2");
      const name = readString(record, "name");
      if (!iso2 || !name) return null;
      return { iso2, name };
    })
    .filter((row): row is CscState => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCscCities(countryCode: string, stateCode: string): Promise<CscCity[]> {
  const country = countryCode.trim().toUpperCase();
  const state = stateCode.trim().toUpperCase();
  if (!country || !state) return [];
  const rows = await cscFetch<unknown[]>(
    `/countries/${encodeURIComponent(country)}/states/${encodeURIComponent(state)}/cities`,
  );
  return rows
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const name = readString(record, "name");
      if (!name) return null;
      return { name };
    })
    .filter((row): row is CscCity => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
