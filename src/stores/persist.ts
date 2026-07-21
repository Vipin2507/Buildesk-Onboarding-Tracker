import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { StateCreator } from "zustand";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const BUILDESK_PREFIX = "buildesk-";

/** Keys that are allowed to live in localStorage (small config only). */
const PERSIST_ALLOWLIST = new Set([
  `${BUILDESK_PREFIX}master-config-v2`,
  `${BUILDESK_PREFIX}app-settings-v1`,
  `${BUILDESK_PREFIX}design-tickets-v1`,
  `${BUILDESK_PREFIX}company-portal-v1`,
]);

/** Legacy / oversized entity caches — safe to wipe; SQLite is authoritative. */
const LEGACY_CACHE_KEYS = [
  "users",
  "users-v2",
  "employees",
  "employees-v2",
  "companies",
  "companies-v5",
  "projects",
  "projects-v3",
  "activity",
  "activity-v2",
  "activity-v3",
  "onboarding",
  "onboarding-v3",
  "vendors",
  "vendors-v2",
  "labor",
  "labor-v2",
  "tickets",
  "tickets-v3",
  "training",
  "training-v3",
  "documents",
  "documents-v2",
  "integrations",
  "integrations-v2",
  "post-sales",
  "post-sales-v4",
  "notes-attachments",
  "notes-attachments-v3",
  "project-progress",
  "project-progress-v2",
  "project-manual-progress-v1",
];

let didPurgeLegacy = false;

/** Drop old entity mirrors so quota frees up for theme + config. */
export function purgeLegacyEntityCaches() {
  if (typeof window === "undefined" || didPurgeLegacy) return;
  didPurgeLegacy = true;
  try {
    for (const key of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(`${BUILDESK_PREFIX}${key}`);
    }
    // Also remove any other buildesk-* keys that are not allowlisted
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BUILDESK_PREFIX)) continue;
      if (PERSIST_ALLOWLIST.has(k)) continue;
      if (k === "buildesk-theme") continue;
      toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function stripHeavyPayloads(value: unknown): unknown {
  if (typeof value === "string") {
    // Base64 data URLs (avatars, logos) blow the 5MB quota
    if (value.startsWith("data:")) return "";
    if (value.length > 50_000) return "";
    return value;
  }
  if (Array.isArray(value)) return value.map(stripHeavyPayloads);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((k === "avatarUrl" || k === "logoUrl") && typeof v === "string" && v.startsWith("data:")) {
        out[k] = "";
        continue;
      }
      out[k] = stripHeavyPayloads(v);
    }
    return out;
  }
  return value;
}

function createSafeStorage(): StateStorage {
  if (typeof window === "undefined") return noopStorage;

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      const write = (payload: string) => localStorage.setItem(name, payload);

      try {
        write(value);
        return;
      } catch (first) {
        const isQuota =
          first instanceof DOMException &&
          (first.name === "QuotaExceededError" ||
            first.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            first.code === 22);

        if (!isQuota) {
          console.warn(`[buildesk] localStorage setItem failed for "${name}"`, first);
          return;
        }

        // Free space: drop legacy entity caches, strip data URLs, retry once
        purgeLegacyEntityCaches();
        try {
          const parsed = JSON.parse(value) as unknown;
          const slim = JSON.stringify(stripHeavyPayloads(parsed));
          write(slim);
          console.warn(`[buildesk] Persisted slimmed "${name}" after quota recovery`);
          return;
        } catch (second) {
          console.warn(
            `[buildesk] Skipping persist for "${name}" — localStorage quota still exceeded`,
            second,
          );
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        }
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

function getStorage(): StateStorage {
  return createSafeStorage();
}

/**
 * In-memory Zustand store for server-backed entity data.
 * Do not write companies/projects/users to localStorage — SQLite is the source of truth.
 */
export function createStore<T extends object>(initializer: StateCreator<T>) {
  return create<T>()(initializer);
}

/** Persist only small config (master catalog, app settings). Uses quota-safe storage. */
export function createPersistedStore<T extends object>(
  name: string,
  initializer: StateCreator<T, [], [["zustand/persist", T]]>,
) {
  return create<T>()(
    persist(initializer, {
      name: `${BUILDESK_PREFIX}${name}`,
      storage: createJSONStorage(getStorage),
      version: 1,
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error && typeof window !== "undefined") {
          console.warn(`[buildesk] Clearing corrupt store "${name}"`, error);
          try {
            localStorage.removeItem(`${BUILDESK_PREFIX}${name}`);
          } catch {
            /* ignore */
          }
        }
      },
    }),
  );
}

export function touch<T extends { updatedAt: string }>(entity: T): T {
  return { ...entity, updatedAt: new Date().toISOString() };
}
