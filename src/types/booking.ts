/** CRM portal booking (Cal.com-lite) types. */

export type BookingAppointmentStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export type BookingCreatedVia = "portal" | "crm";

export type BookingEventType = {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  durationMinutes: number;
  hostUserId?: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BookingAvailability = {
  id: string;
  hostUserId: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BookingBlock = {
  id: string;
  hostUserId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingAppointment = {
  id: string;
  eventTypeId: string;
  companyId: string;
  hostUserId: string;
  startsAt: string;
  endsAt: string;
  status: BookingAppointmentStatus;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  hostNote?: string;
  createdVia: BookingCreatedVia;
  createdAt: string;
  updatedAt: string;
};

export type BookingSlot = {
  startsAt: string;
  endsAt: string;
};

export const DEFAULT_BOOKING_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_BOOKING_DURATION_MINUTES = 30;
export const DEFAULT_BOOKING_EVENT_SLUG = "discovery-call";
export const DEFAULT_BOOKING_EVENT_TITLE = "Discovery / Onboarding call";
