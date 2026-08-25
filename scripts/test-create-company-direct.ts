/**
 * Direct server-side create test (bypasses HTTP) — verifies SQLite persistence.
 */
import { eq } from "drizzle-orm";

import { createCompanyModules } from "../src/data/module-catalog";
import { getDb, getSqlite } from "../src/server/db/client";
import * as t from "../src/server/db/schema";
import { loadCompanies, loadCompany } from "../src/server/api/mappers";
import { newId, nowIso } from "../src/types";

const dbPath = getSqlite().name;
console.log("DB path:", dbPath);

const db = getDb();
const id = newId();
const now = nowIso();
const modules = createCompanyModules(["post-sales"], now.slice(0, 10));

db.insert(t.companies)
  .values({
    id,
    name: "TEST PERSIST CO",
    contact: "Test",
    designation: "Director",
    phone: "9876543210",
    email: "test-persist@example.com",
    city: "Mumbai",
    region: "West",
    ownerName: "Test",
    ownerMobile: "9876543210",
    pocName: "Test",
    pocMobile: "9876543210",
    onboardingManagerId: "user-2",
    csmId: "",
    status: "not_started",
    agreementDate: now.slice(0, 10),
    startDate: now.slice(0, 10),
    goLiveTarget: now.slice(0, 10),
    planExpiry: now.slice(0, 10),
    plan: "Half-Yearly",
    health: "Healthy",
    companyType: "Real Estate Developer",
    state: "MH",
    createdAt: now,
    updatedAt: now,
  })
  .run();

for (const m of modules.filter((x) => x.optedIn)) {
  db.insert(t.companyModules)
    .values({
      id: newId(),
      companyId: id,
      moduleKey: m.moduleKey,
      label: m.label,
      optedIn: m.optedIn,
      optedOnDate: m.optedOnDate ?? null,
      liveAt: null,
      pocName: null,
      pocMobile: null,
    })
    .run();
}

const loaded = loadCompany(id);
const inList = loadCompanies().some((c) => c.id === id);
console.log("loadCompany:", loaded?.name ?? "MISSING");
console.log("in loadCompanies:", inList);

getDb().delete(t.companies).where(eq(t.companies.id, id)).run();
console.log("cleaned up test row");
