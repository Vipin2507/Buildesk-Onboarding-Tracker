import { toast } from "sonner";

import {
  CHATBOT_ESCALATING,
  CHATBOT_FALLBACK,
  CHATBOT_GREETING,
} from "@/data/chatbotResponses";
import { getBotResponse, matchQuickReplyLabel } from "@/services/chatbot";
import type { ChatMessage, ChatSession, ChatSessionStatus } from "@/types/chat";
import { nowIso } from "@/types";
import { useTicketStore } from "./useTicketStore";
import { useCompanyStore } from "./useCompanyStore";
import { useProjectStore } from "./useProjectStore";
import { createPersistedStore, touch } from "./persist";

type ChatState = {
  sessions: ChatSession[];
  activeInternalSessionId: string | null;
  activePortalSessionId: string | null;
  setActiveInternalSession: (id: string | null) => void;
  setActivePortalSession: (id: string | null) => void;
  startSession: (input: {
    visitorName: string;
    companyId?: string;
    portalSlug?: string;
  }) => ChatSession;
  getSession: (id: string) => ChatSession | undefined;
  getPortalSession: (portalSlug: string) => ChatSession | undefined;
  sendCustomerMessage: (
    sessionId: string,
    text: string,
    opts?: { skipBot?: boolean },
  ) => void;
  sendQuickReply: (sessionId: string, label: string) => void;
  sendAgentMessage: (sessionId: string, agentId: string, agentName: string, text: string) => void;
  escalateToAgent: (sessionId: string) => void;
  claimSession: (sessionId: string, agentId: string, agentName: string) => void;
  convertToTicket: (sessionId: string) => string | null;
  closeSession: (sessionId: string) => void;
  markSessionRead: (sessionId: string, reader: "agent" | "customer") => void;
  getLiveChatBadgeCount: () => number;
  getUnreadForAgent: () => number;
};

function msgId() {
  return `CM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sessionId() {
  return `CS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function pushMessage(session: ChatSession, message: Omit<ChatMessage, "id" | "sessionId">): ChatSession {
  const full: ChatMessage = {
    ...message,
    id: msgId(),
    sessionId: session.id,
  };
  return touch({
    ...session,
    messages: [...session.messages, full],
  });
}

export const useChatStore = createPersistedStore<ChatState>("chat-v1", (set, get) => ({
  sessions: [],
  activeInternalSessionId: null,
  activePortalSessionId: null,

  setActiveInternalSession: (id) => set({ activeInternalSessionId: id }),
  setActivePortalSession: (id) => set({ activePortalSessionId: id }),

  startSession: ({ visitorName, companyId, portalSlug }) => {
    const existing = get().sessions.find(
      (s) =>
        s.portalSlug === portalSlug &&
        portalSlug &&
        s.status !== "closed" &&
        s.visitorName === visitorName,
    );
    if (existing) {
      set({ activePortalSessionId: existing.id });
      return existing;
    }

    const now = nowIso();
    const session: ChatSession = {
      id: sessionId(),
      companyId,
      portalSlug,
      visitorName,
      status: "bot-handling",
      createdAt: now,
      updatedAt: now,
      messages: [],
      botAttempts: 0,
    };

    const withGreeting = pushMessage(session, {
      senderType: "bot",
      senderName: "Buildesk Assistant",
      text: CHATBOT_GREETING,
      createdAt: now,
      isRead: false,
    });

    set((s) => ({
      sessions: [withGreeting, ...s.sessions],
      activePortalSessionId: withGreeting.id,
    }));
    return withGreeting;
  },

  getSession: (id) => get().sessions.find((s) => s.id === id),

  getPortalSession: (portalSlug) =>
    get().sessions.find(
      (s) => s.portalSlug === portalSlug && s.status !== "closed",
    ),

  sendCustomerMessage: (sessionId, text, opts) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;

    let next = pushMessage(session, {
      senderType: "customer",
      senderName: session.visitorName,
      text: trimmed,
      createdAt: nowIso(),
      isRead: false,
    });

    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));

    if (opts?.skipBot || next.status === "waiting-for-agent" || next.status === "agent-active") {
      return;
    }

    const botReply = getBotResponse(trimmed);
    if (botReply === "__ESCALATE__") {
      get().escalateToAgent(sessionId);
      return;
    }

    if (botReply) {
      next = pushMessage(next, {
        senderType: "bot",
        senderName: "Buildesk Assistant",
        text: botReply,
        createdAt: nowIso(),
        isRead: false,
      });
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
      }));
      return;
    }

    const attempts = next.botAttempts + 1;
    next = { ...next, botAttempts: attempts };
    if (attempts >= 2) {
      get().escalateToAgent(sessionId);
      return;
    }

    next = pushMessage(next, {
      senderType: "bot",
      senderName: "Buildesk Assistant",
      text: CHATBOT_FALLBACK,
      createdAt: nowIso(),
      isRead: false,
    });
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));
  },

  sendQuickReply: (sessionId, label) => {
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;

    let next = pushMessage(session, {
      senderType: "customer",
      senderName: session.visitorName,
      text: label,
      createdAt: nowIso(),
      isRead: false,
    });
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));

    const response = matchQuickReplyLabel(label);
    if (response === "__ESCALATE__") {
      get().escalateToAgent(sessionId);
      return;
    }
    if (response) {
      next = pushMessage(next, {
        senderType: "bot",
        senderName: "Buildesk Assistant",
        text: response,
        createdAt: nowIso(),
        isRead: false,
      });
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
      }));
    }
  },

  sendAgentMessage: (sessionId, agentId, agentName, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;

    let next = pushMessage(session, {
      senderType: "agent",
      senderName: agentName,
      text: trimmed,
      createdAt: nowIso(),
      isRead: false,
    });
    next = {
      ...next,
      status: "agent-active",
      assignedAgentId: agentId,
      assignedAgentName: agentName,
    };
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));
  },

  escalateToAgent: (sessionId) => {
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;
    if (session.status === "waiting-for-agent" || session.status === "agent-active") return;

    const next = pushMessage(
      { ...session, status: "waiting-for-agent" },
      {
        senderType: "bot",
        senderName: "Buildesk Assistant",
        text: CHATBOT_ESCALATING,
        createdAt: nowIso(),
        isRead: false,
      },
    );
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));
  },

  claimSession: (sessionId, agentId, agentName) => {
    const session = get().getSession(sessionId);
    if (!session) return;
    const next = touch({
      ...session,
      status: "agent-active" as ChatSessionStatus,
      assignedAgentId: agentId,
      assignedAgentName: agentName,
    });
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
      activeInternalSessionId: sessionId,
    }));
  },

  convertToTicket: (sessionId) => {
    const session = get().getSession(sessionId);
    if (!session || !session.companyId) {
      toast.error("Cannot convert — company not linked to this chat");
      return null;
    }

    const transcript = session.messages
      .map((m) => `[${m.senderName}] ${m.text}`)
      .join("\n");

    const projects = useProjectStore
      .getState()
      .projects.filter((p) => p.companyId === session.companyId);
    const projectId = projects[0]?.id ?? "";
    const developerId = useCompanyStore.getState().companies.find((c) => c.id === session.companyId)
      ?.onboardingManagerId ?? "";

    const ticket = useTicketStore.getState().addTicket({
      type: "Other",
      title: `Chat: ${session.visitorName}`,
      priority: "Medium",
      status: "Open",
      raisedOn: new Date().toISOString().slice(0, 10),
      eta: "",
      developerId,
      companyId: session.companyId,
      projectId,
      description: `Converted from live chat session ${session.id}\n\n${transcript}`,
    });

    const next = touch({ ...session, linkedTicketId: ticket.id });
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));
    toast.success(`Ticket ${ticket.id} created from chat`);
    return ticket.id;
  },

  closeSession: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? touch({ ...x, status: "closed" as ChatSessionStatus }) : x,
      ),
    }));
  },

  markSessionRead: (sessionId, reader) => {
    set((s) => ({
      sessions: s.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          messages: session.messages.map((m) => {
            if (reader === "agent" && m.senderType === "customer") return { ...m, isRead: true };
            if (reader === "customer" && m.senderType !== "customer") return { ...m, isRead: true };
            return m;
          }),
        };
      }),
    }));
  },

  getLiveChatBadgeCount: () => {
    const { sessions } = get();
    return sessions.filter((s) => {
      if (s.status === "closed") return false;
      if (s.status === "waiting-for-agent") return true;
      return s.messages.some((m) => m.senderType === "customer" && !m.isRead);
    }).length;
  },

  getUnreadForAgent: () => get().getLiveChatBadgeCount(),
}));
