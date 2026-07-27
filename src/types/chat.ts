export type ChatSenderType = "customer" | "bot" | "agent";

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: ChatSenderType;
  senderName: string;
  text: string;
  createdAt: string;
  isRead: boolean;
}

export type ChatSessionStatus = "bot-handling" | "waiting-for-agent" | "agent-active" | "closed";

export interface ChatSession {
  id: string;
  companyId?: string;
  portalSlug?: string;
  visitorName: string;
  status: ChatSessionStatus;
  assignedAgentId?: string;
  assignedAgentName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  linkedTicketId?: string;
  botAttempts: number;
  lastNotifiedAt?: string;
}
