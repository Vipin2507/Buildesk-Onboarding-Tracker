export type CrmUsageKeySource = "portal" | "monitor" | "none";

export type CrmUsageAccount = {
  id: string;
  name: string;
  status: string;
  city: string;
  salesManagerName: string;
  supportManager1: string;
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
  ok: boolean;
  error: string;
  hasCrmActivity: boolean;
  leadOnly: boolean;
  hasCalls: boolean;
  leads: number;
  followups: number;
  visits: number;
  bookings: number | null;
  calls: number;
  activeUsers: number;
  score: number;
};
