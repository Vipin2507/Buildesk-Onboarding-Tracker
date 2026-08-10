import type { CompanyRegion } from "@/types/company";

export type IndiaLocation = {
  city: string;
  state: string;
  country: string;
  region: CompanyRegion;
};

/** Curated city → state / country / Buildesk region map for CRM account forms. */
export const INDIA_LOCATIONS: IndiaLocation[] = [
  { city: "Ahmedabad", state: "Gujarat", country: "India", region: "West" },
  { city: "Bengaluru", state: "Karnataka", country: "India", region: "South" },
  { city: "Chandigarh", state: "Chandigarh", country: "India", region: "NCR" },
  { city: "Chennai", state: "Tamil Nadu", country: "India", region: "South" },
  { city: "Coimbatore", state: "Tamil Nadu", country: "India", region: "South" },
  { city: "Delhi", state: "Delhi", country: "India", region: "NCR" },
  { city: "Faridabad", state: "Haryana", country: "India", region: "NCR" },
  { city: "Ghaziabad", state: "Uttar Pradesh", country: "India", region: "NCR" },
  { city: "Goa", state: "Goa", country: "India", region: "West" },
  { city: "Gurugram", state: "Haryana", country: "India", region: "NCR" },
  { city: "Gurgaon", state: "Haryana", country: "India", region: "NCR" },
  { city: "Hyderabad", state: "Telangana", country: "India", region: "South" },
  { city: "Indore", state: "Madhya Pradesh", country: "India", region: "Rest of India" },
  { city: "Jaipur", state: "Rajasthan", country: "India", region: "Rest of India" },
  { city: "Kochi", state: "Kerala", country: "India", region: "South" },
  { city: "Kolkata", state: "West Bengal", country: "India", region: "Rest of India" },
  { city: "Lucknow", state: "Uttar Pradesh", country: "India", region: "Rest of India" },
  { city: "Mumbai", state: "Maharashtra", country: "India", region: "West" },
  { city: "Nagpur", state: "Maharashtra", country: "India", region: "West" },
  { city: "Noida", state: "Uttar Pradesh", country: "India", region: "NCR" },
  { city: "Pune", state: "Maharashtra", country: "India", region: "West" },
  { city: "Surat", state: "Gujarat", country: "India", region: "West" },
  { city: "Thane", state: "Maharashtra", country: "India", region: "West" },
  { city: "Vadodara", state: "Gujarat", country: "India", region: "West" },
  { city: "Visakhapatnam", state: "Andhra Pradesh", country: "India", region: "South" },
];

const STATE_REGION: Record<string, CompanyRegion> = {
  Delhi: "NCR",
  Haryana: "NCR",
  Chandigarh: "NCR",
  "Uttar Pradesh": "NCR",
  Karnataka: "South",
  "Tamil Nadu": "South",
  Telangana: "South",
  Kerala: "South",
  "Andhra Pradesh": "South",
  Maharashtra: "West",
  Gujarat: "West",
  Goa: "West",
  Rajasthan: "Rest of India",
  "Madhya Pradesh": "Rest of India",
  "West Bengal": "Rest of India",
};

export const INDIA_CITIES = [...new Set(INDIA_LOCATIONS.map((l) => l.city))].sort((a, b) =>
  a.localeCompare(b),
);

export const INDIA_STATES = [...new Set(INDIA_LOCATIONS.map((l) => l.state))].sort((a, b) =>
  a.localeCompare(b),
);

export const ACCOUNT_COUNTRIES = ["India"] as const;

export function findLocationByCity(city: string): IndiaLocation | undefined {
  const needle = city.trim().toLowerCase();
  if (!needle) return undefined;

  const exact = INDIA_LOCATIONS.find((l) => l.city.toLowerCase() === needle);
  if (exact) return exact;

  // Common aliases / partial matches (e.g. "Bangalore" → Bengaluru, "Gurgaon" → Gurugram)
  const aliases: Record<string, string> = {
    bangalore: "bengaluru",
    gurgaon: "gurugram",
    bombay: "mumbai",
    calcutta: "kolkata",
    madras: "chennai",
    trivandrum: "kochi",
    vizag: "visakhapatnam",
  };
  const aliased = aliases[needle];
  if (aliased) {
    return INDIA_LOCATIONS.find((l) => l.city.toLowerCase() === aliased);
  }

  return INDIA_LOCATIONS.find(
    (l) => l.city.toLowerCase().includes(needle) || needle.includes(l.city.toLowerCase()),
  );
}


export function countryForState(state: string): string {
  return state.trim() ? "India" : "";
}

export function regionForState(state: string): CompanyRegion {
  return STATE_REGION[state.trim()] ?? "Rest of India";
}

export function citiesForState(state: string): string[] {
  const s = state.trim();
  if (!s) return INDIA_CITIES;
  return INDIA_LOCATIONS.filter((l) => l.state === s)
    .map((l) => l.city)
    .sort((a, b) => a.localeCompare(b));
}
