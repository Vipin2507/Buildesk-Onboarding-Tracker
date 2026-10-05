import { createStore } from "./persist";

type WhatsappEngagementState = {
  /** accountId → latest WAHA message unix timestamp (seconds). */
  lastByAccountId: Record<string, number>;
  hydrate: (rows: { accountId: string; timestamp: number }[]) => void;
};

export const useCrmWhatsappEngagementStore = createStore<WhatsappEngagementState>((set) => ({
  lastByAccountId: {},
  hydrate: (rows) => {
    const next: Record<string, number> = {};
    for (const row of rows) {
      if (!row.accountId || !Number.isFinite(row.timestamp) || row.timestamp <= 0) continue;
      const prev = next[row.accountId] ?? 0;
      if (row.timestamp > prev) next[row.accountId] = row.timestamp;
    }
    set({ lastByAccountId: next });
  },
}));
