import type { Timestamps } from "./common";

export type ErpMeetingStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "postponed"
  | "no_show";

export const ERP_MEETING_STATUSES: ErpMeetingStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
  "postponed",
  "no_show",
];

export type ErpMeetingType =
  | "kickoff"
  | "training"
  | "review"
  | "demo"
  | "check_in"
  | "other";

export const ERP_MEETING_TYPES: ErpMeetingType[] = [
  "kickoff",
  "training",
  "review",
  "demo",
  "check_in",
  "other",
];

export const ERP_MEETING_TYPE_LABELS: Record<ErpMeetingType, string> = {
  kickoff: "Kickoff",
  training: "Training",
  review: "Review",
  demo: "Demo",
  check_in: "Check-in",
  other: "Other",
};

export type ErpMeetingFormat = "online" | "in_person" | "phone";

export const ERP_MEETING_FORMATS: ErpMeetingFormat[] = ["online", "in_person", "phone"];

export const ERP_MEETING_FORMAT_LABELS: Record<ErpMeetingFormat, string> = {
  online: "Online",
  in_person: "In person",
  phone: "Phone",
};

export type ErpMeetingGoogleSyncStatus = "none" | "synced" | "error";

export type ErpMeeting = Timestamps & {
  id: string;
  companyId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  status: ErpMeetingStatus;
  meetingType: ErpMeetingType;
  format: ErpMeetingFormat;
  hostUserId?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  location?: string;
  meetingLink?: string;
  notes?: string;
  outcome?: string;
  createdByUserId?: string;
  googleEventId?: string;
  meetUrl?: string;
  googleSyncStatus?: ErpMeetingGoogleSyncStatus;
  googleSyncError?: string;
};
