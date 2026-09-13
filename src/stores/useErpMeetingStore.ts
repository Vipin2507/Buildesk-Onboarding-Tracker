import type { ErpMeeting } from "@/types";
import { newId, nowIso } from "@/types";
import {
  createErpMeeting as apiCreate,
  retryErpMeetingGoogleCalendarSync,
  updateErpMeeting as apiUpdate,
} from "@/lib/api";
import { serverSyncWithRollback } from "@/lib/sync";
import { createStore, touch } from "./persist";

type ErpMeetingState = {
  meetings: ErpMeeting[];
  setMeetings: (meetings: ErpMeeting[]) => void;
  addMeeting: (data: Omit<ErpMeeting, "id" | "createdAt" | "updatedAt">) => ErpMeeting;
  updateMeeting: (id: string, data: Partial<ErpMeeting>) => void;
  retryGoogleCalendarSync: (id: string) => Promise<ErpMeeting | undefined>;
  getById: (id: string) => ErpMeeting | undefined;
  getByCompany: (companyId: string) => ErpMeeting[];
};

export const useErpMeetingStore = createStore<ErpMeetingState>((set, get) => ({
  meetings: [],

  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (data) => {
    const now = nowIso();
    const meeting: ErpMeeting = {
      ...data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ meetings: [meeting, ...s.meetings] }));
    serverSyncWithRollback(
      "createErpMeeting",
      () =>
        apiCreate({
          data: {
            id: meeting.id,
            companyId: meeting.companyId,
            title: meeting.title,
            startsAt: meeting.startsAt,
            endsAt: meeting.endsAt,
            status: meeting.status,
            meetingType: meeting.meetingType,
            format: meeting.format,
            hostUserId: meeting.hostUserId,
            attendeeName: meeting.attendeeName,
            attendeeEmail: meeting.attendeeEmail,
            location: meeting.location,
            meetingLink: meeting.meetingLink,
            notes: meeting.notes,
            outcome: meeting.outcome,
          },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              meetings: s.meetings.map((m) => (m.id === meeting.id ? saved : m)),
            }));
          }
          return saved;
        }),
      () => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== meeting.id) })),
    );
    return meeting;
  },

  updateMeeting: (id, data) => {
    const previous = get().getById(id);
    if (!previous) return;
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === id ? touch({ ...m, ...data }) : m)),
    }));
    serverSyncWithRollback(
      "updateErpMeeting",
      () =>
        apiUpdate({
          data: { id, patch: data },
        }).then((saved) => {
          if (saved) {
            set((s) => ({
              meetings: s.meetings.map((m) => (m.id === id ? saved : m)),
            }));
          }
          return saved;
        }),
      () =>
        set((s) => ({
          meetings: s.meetings.map((m) => (m.id === id ? previous : m)),
        })),
    );
  },

  retryGoogleCalendarSync: async (id) => {
    try {
      const saved = await retryErpMeetingGoogleCalendarSync({ data: { id } });
      if (saved) {
        set((s) => ({
          meetings: s.meetings.map((m) => (m.id === id ? saved : m)),
        }));
      }
      return saved;
    } catch {
      return undefined;
    }
  },

  getById: (id) => get().meetings.find((m) => m.id === id),
  getByCompany: (companyId) => get().meetings.filter((m) => m.companyId === companyId),
}));
