import { toast } from "sonner";

import {
  CHATBOT_ESCALATING,
  CHATBOT_FALLBACK,
  CHATBOT_GREETING,
} from "@/data/chatbotResponses";
import {
  CHAT_IDLE_AUTO_CLOSE_MESSAGE,
  CHAT_IDLE_CHECK_MESSAGE,
  CHAT_IDLE_CLOSE_AFTER_MS,
  CHAT_IDLE_PROMPT_AFTER_MS,
  CHAT_IDLE_STILL_HERE_LABEL,
} from "@/lib/chat-idle";
import {
  createPortalChatSession,
  syncChatSession,
  syncPortalChatSession,
} from "@/lib/api";
import { getBotResponse, matchQuickReplyLabel } from "@/services/chatbot";
import type { ChatMessage, ChatSession, ChatSessionStatus } from "@/types/chat";
import { nowIso } from "@/types";
import { serverSync } from "@/lib/sync";
import { useTicketStore } from "./useTicketStore";
import { useCompanyStore } from "./useCompanyStore";
import { useCrmAccountStore } from "./useCrmAccountStore";
import { useProjectStore } from "./useProjectStore";
import { createStore, touch } from "./persist";
import { CRM_TICKET_PROJECT_ID, isCrmChatSession } from "@/lib/crm-tickets";

type ChatState = {
  sessions: ChatSession[];
  activeInternalSessionId: string | null;
  activePortalSessionId: string | null;
  hydrateSessions: (sessions: ChatSession[]) => void;
  syncSessionsFromServer: (sessions: ChatSession[]) => void;
  mergeSession: (session: ChatSession) => void;
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
  confirmStillOnline: (sessionId: string) => void;
  processIdleSessions: (nowMs?: number) => void;
  markSessionRead: (sessionId: string, reader: "agent" | "customer") => void;
  getLiveChatBadgeCount: (scope?: "all" | "crm" | "erp") => number;
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

function clearIdleCheck(session: ChatSession): ChatSession {
  if (!session.idleCheckAt) return session;
  return { ...session, idleCheckAt: undefined };
}

function lastMessage(session: ChatSession) {
  return session.messages[session.messages.length - 1];
}

/** True when the ball is in the client's court (last speaker was bot/agent). */
function waitingOnCustomer(session: ChatSession): boolean {
  const last = lastMessage(session);
  if (!last) return true;
  return last.senderType !== "customer";
}

/** Prevents duplicate idle prompts when portal + agent bootstraps race. */
const idleActionLocks = new Set<string>();

function withIdleLock(sessionId: string, action: string, fn: () => void) {
  const key = `${sessionId}:${action}`;
  if (idleActionLocks.has(key)) return;
  idleActionLocks.add(key);
  try {
    fn();
  } finally {
    globalThis.setTimeout(() => idleActionLocks.delete(key), 8_000);
  }
}

function pushToServer(get: () => ChatState, sessionId: string) {
  const session = get().getSession(sessionId);
  if (!session) return;

  if (session.portalSlug) {
    serverSync("portal chat", () =>
      syncPortalChatSession({
        data: { slug: session.portalSlug!, session },
      }).then((saved) => get().mergeSession(saved)),
    );
    return;
  }

  serverSync("chat", () =>
    syncChatSession({ data: session }).then((saved) => get().mergeSession(saved)),
  );
}

export const useChatStore = createStore<ChatState>((set, get) => ({
  sessions: [],
  activeInternalSessionId: null,
  activePortalSessionId: null,

  hydrateSessions: (sessions) => set({ sessions }),

  syncSessionsFromServer: (incoming) => {
    set((s) => {
      const next = new Map(s.sessions.map((x) => [x.id, x]));
      for (const session of incoming) {
        const prev = next.get(session.id);
        if (!prev) {
          next.set(session.id, session);
          continue;
        }
        if (
          session.updatedAt < prev.updatedAt &&
          session.messages.length < prev.messages.length
        ) {
          continue;
        }
        next.set(session.id, session);
      }
      return {
        sessions: [...next.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      };
    });
  },

  mergeSession: (session) => {
    set((s) => {
      const idx = s.sessions.findIndex((x) => x.id === session.id);
      if (idx === -1) return { sessions: [session, ...s.sessions] };
      const prev = s.sessions[idx];
      if (
        session.updatedAt < prev.updatedAt &&
        session.messages.length < prev.messages.length
      ) {
        return s;
      }
      const next = [...s.sessions];
      next[idx] = session;
      return { sessions: next };
    });
  },

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
    const id = sessionId();
    const session: ChatSession = {
      id,
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

    if (portalSlug) {
      serverSync("portal chat create", () =>
        createPortalChatSession({
          data: { slug: portalSlug, visitorName, sessionId: id },
        }).then((saved) => {
          get().mergeSession(saved);
          set({ activePortalSessionId: saved.id });
        }),
      );
    }

    return withGreeting;
  },

  getSession: (id) => get().sessions.find((s) => s.id === id),

  getPortalSession: (portalSlug) =>
    get().sessions.find((s) => s.portalSlug === portalSlug && s.status !== "closed"),

  sendCustomerMessage: (sessionId, text, opts) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;

    let next = clearIdleCheck(
      pushMessage(session, {
        senderType: "customer",
        senderName: session.visitorName,
        text: trimmed,
        createdAt: nowIso(),
        isRead: false,
      }),
    );

    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
    }));

    if (opts?.skipBot || next.status === "waiting-for-agent" || next.status === "agent-active") {
      pushToServer(get, sessionId);
      return;
    }

    const botReply = getBotResponse(trimmed, {
      companyId: next.companyId,
      visitorName: next.visitorName,
    });
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
      pushToServer(get, sessionId);
      return;
    }

    const attempts = next.botAttempts + 1;
    next = { ...next, botAttempts: attempts };
    if (attempts >= 2) {
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === sessionId ? next : x)),
      }));
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
    pushToServer(get, sessionId);
  },

  sendQuickReply: (sessionId, label) => {
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;

    let next = clearIdleCheck(
      pushMessage(session, {
        senderType: "customer",
        senderName: session.visitorName,
        text: label,
        createdAt: nowIso(),
        isRead: false,
      }),
    );
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
    pushToServer(get, sessionId);
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
    pushToServer(get, sessionId);
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
    pushToServer(get, sessionId);
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
    pushToServer(get, sessionId);
  },

  convertToTicket: (sessionId) => {
    const session = get().getSession(sessionId);
    if (!session || !session.companyId) {
      toast.error("Cannot convert — company not linked to this chat");
      return null;
    }

    const transcript = session.messages.map((m) => `[${m.senderName}] ${m.text}`).join("\n");

    const isCrmAccount = Boolean(
      useCrmAccountStore.getState().getById(session.companyId),
    );
    const projects = useProjectStore
      .getState()
      .projects.filter((p) => p.companyId === session.companyId);
    const projectId = isCrmAccount ? CRM_TICKET_PROJECT_ID : projects[0]?.id ?? "";
    const developerId = isCrmAccount
      ? ""
      : useCompanyStore.getState().companies.find((c) => c.id === session.companyId)
          ?.onboardingManagerId ?? "";

    const ticket = useTicketStore.getState().addTicket({
      type: "Other",
      title: isCrmAccount
        ? `[CRM] Chat: ${session.visitorName}`
        : `Chat: ${session.visitorName}`,
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
    pushToServer(get, sessionId);
    toast.success(`Ticket ${ticket.id} created from chat`);
    return ticket.id;
  },

  closeSession: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId
          ? touch({ ...x, status: "closed" as ChatSessionStatus, idleCheckAt: undefined })
          : x,
      ),
    }));
    pushToServer(get, sessionId);
  },

  confirmStillOnline: (sessionId) => {
    const session = get().getSession(sessionId);
    if (!session || session.status === "closed") return;
    get().sendCustomerMessage(sessionId, CHAT_IDLE_STILL_HERE_LABEL, { skipBot: true });
  },

  processIdleSessions: (nowMs = Date.now()) => {
    const open = get().sessions.filter((s) => s.status !== "closed");
    for (const session of open) {
      if (!waitingOnCustomer(session)) continue;

      const last = lastMessage(session);
      const idleSinceMs = Date.parse(last?.createdAt ?? session.updatedAt);
      if (!Number.isFinite(idleSinceMs)) continue;

      // Already prompted — close if the client never replied.
      if (session.idleCheckAt) {
        const promptedMs = Date.parse(session.idleCheckAt);
        if (!Number.isFinite(promptedMs)) continue;
        if (nowMs - promptedMs < CHAT_IDLE_CLOSE_AFTER_MS) continue;

        withIdleLock(session.id, "close", () => {
          const current = get().getSession(session.id);
          if (!current || current.status === "closed" || !current.idleCheckAt) return;
          const now = nowIso();
          let next = pushMessage(current, {
            senderType: "bot",
            senderName: "Buildesk Assistant",
            text: CHAT_IDLE_AUTO_CLOSE_MESSAGE,
            createdAt: now,
            isRead: false,
          });
          next = touch({
            ...next,
            status: "closed" as ChatSessionStatus,
            idleCheckAt: undefined,
          });
          set((s) => ({
            sessions: s.sessions.map((x) => (x.id === current.id ? next : x)),
          }));
          pushToServer(get, current.id);
        });
        continue;
      }

      // Waiting for agent — don't nudge the client; they're waiting on us.
      if (session.status === "waiting-for-agent") continue;

      if (nowMs - idleSinceMs < CHAT_IDLE_PROMPT_AFTER_MS) continue;

      withIdleLock(session.id, "prompt", () => {
        const current = get().getSession(session.id);
        if (!current || current.status === "closed" || current.idleCheckAt) return;
        if (!waitingOnCustomer(current)) return;

        const currentLast = lastMessage(current);
        if (currentLast?.senderType === "bot" && currentLast.text === CHAT_IDLE_CHECK_MESSAGE) {
          const next = touch({ ...current, idleCheckAt: currentLast.createdAt });
          set((s) => ({
            sessions: s.sessions.map((x) => (x.id === current.id ? next : x)),
          }));
          pushToServer(get, current.id);
          return;
        }

        const now = nowIso();
        let next = pushMessage(current, {
          senderType: "bot",
          senderName: "Buildesk Assistant",
          text: CHAT_IDLE_CHECK_MESSAGE,
          createdAt: now,
          isRead: false,
        });
        next = touch({ ...next, idleCheckAt: now });
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === current.id ? next : x)),
        }));
        pushToServer(get, current.id);
      });
    }
  },

  markSessionRead: (sessionId, reader) => {
    set((s) => {
      const session = s.sessions.find((x) => x.id === sessionId);
      if (!session) return s;

      const hasUnread = session.messages.some((m) => {
        if (reader === "agent") return m.senderType === "customer" && !m.isRead;
        return m.senderType !== "customer" && !m.isRead;
      });
      if (!hasUnread) return s;

      return {
        sessions: s.sessions.map((sess) => {
          if (sess.id !== sessionId) return sess;
          return touch({
            ...sess,
            messages: sess.messages.map((m) => {
              if (reader === "agent" && m.senderType === "customer" && !m.isRead) {
                return { ...m, isRead: true };
              }
              if (reader === "customer" && m.senderType !== "customer" && !m.isRead) {
                return { ...m, isRead: true };
              }
              return m;
            }),
          });
        }),
      };
    });
    pushToServer(get, sessionId);
  },

  getLiveChatBadgeCount: (scope: "all" | "crm" | "erp" = "all") => {
    const { sessions } = get();
    return sessions.filter((s) => {
      if (s.status === "closed") return false;
      if (scope !== "all") {
        const crm = isCrmChatSession(s);
        if (scope === "crm" && !crm) return false;
        if (scope === "erp" && crm) return false;
      }
      if (s.status === "waiting-for-agent") return true;
      return s.messages.some((m) => m.senderType === "customer" && !m.isRead);
    }).length;
  },

  getUnreadForAgent: () => get().getLiveChatBadgeCount("all"),
}));
