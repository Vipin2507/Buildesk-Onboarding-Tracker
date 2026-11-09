export type CrmUsageKeySource = "portal" | "monitor" | "none";

export type CrmUsageAccount = {
  id: string;
  name: string;
  status: string;
  city: string;
  salesManagerName: string;
  supportManager1: string;
  supportManager2: string;
  licensedUsers: number;
  connected: boolean;
  keySource: CrmUsageKeySource;
};

export type CrmUsageScanRow = {
  accountId: string;
  ok: boolean;
  connected: boolean;
  error: string;
  leads: number;
  followups: number;
  visitsScheduled: number;
  visitsConducted: number;
  /** Null when the booking endpoint failed and no fallback count exists. */
  bookings: number | null;
  calls: number;
  connectedCalls: number;
  activeUsers: number;
  executiveCount: number;
  crmScore: number;
  activityScore: number;
  hasCrmActivity: boolean;
  hasCalls: boolean;
  leadOnly: boolean;
  usageType: string;
  bookingWarning: string;
  callWarning: string;
};

export type CrmUsageExecutive = {
  name: string;
  team: string;
  leads: number;
  followups: number;
  meetings: number;
  visitsScheduled: number;
  visitsConducted: number;
  bookings: number;
  calls: number;
  connectedCalls: number;
  hasCrmActivity: boolean;
  hasCalls: boolean;
  leadOnly: boolean;
  productive: boolean;
};

export type CrmUsageRecommendation = {
  priority: "High" | "Medium" | "Low";
  finding: string;
  action: string;
};

export type CrmUsageDetail = CrmUsageScanRow & {
  from: string;
  to: string;
  executives: CrmUsageExecutive[];
  bookingDaily: { date: string; count: number }[];
  recommendations: CrmUsageRecommendation[];
};

export type CrmUsageDay = {
  date: string;
  saved: boolean;
  ok: boolean;
  error: string;
  hasCrmActivity: boolean;
  leadOnly: boolean;
  hasCalls: boolean;
  leads: number;
  followups: number;
  visitsScheduled: number;
  visitsConducted: number;
  bookings: number | null;
  calls: number;
  connectedCalls: number;
  activeUsers: number;
  score: number;
  fetchedAt: string;
};

export type CrmUsageSyncState = {
  lastDay: string;
  status: string;
  message: string;
  updatedAt: string;
};

export type CrmUsageBoardRow = CrmUsageAccount & {
  savedDays: number;
  failedDays: number;
  expectedDays: number;
  lastFetchedAt: string;
  summary: CrmUsageScanRow | null;
};

export type CrmUsageBoard = {
  from: string;
  to: string;
  expectedDays: number;
  sync: CrmUsageSyncState | null;
  rows: CrmUsageBoardRow[];
};

export type CrmUsagePersonTotal = CrmUsageExecutive & {
  activeDays: number;
};

export type CrmUsageAccountPage = {
  account: CrmUsageAccount;
  from: string;
  to: string;
  expectedDays: number;
  savedDays: number;
  failedDays: number;
  lastFetchedAt: string;
  summary: CrmUsageScanRow | null;
  days: CrmUsageDay[];
  people: CrmUsagePersonTotal[];
  recommendations: CrmUsageRecommendation[];
  pattern: string;
};

export type CrmUsageRefreshResult = {
  fetched: number;
  skipped: number;
  failed: number;
  kept: number;
};
