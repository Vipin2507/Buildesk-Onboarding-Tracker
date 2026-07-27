export type ChatbotQuickReply = {
  id: string;
  label: string;
  keywords: string[];
  response: string;
};

export const CHATBOT_GREETING =
  "Hi! How can we help you today? Choose a topic below or type your question.";

export const CHATBOT_QUICK_REPLIES: ChatbotQuickReply[] = [
  {
    id: "ticket-status",
    label: "Ticket status",
    keywords: ["ticket", "status", "track", "update", "progress"],
    response:
      "You can view all open tickets under My Tickets in the portal. If you share your ticket number here, we can look it up for you.",
  },
  {
    id: "billing",
    label: "Billing question",
    keywords: ["billing", "invoice", "payment", "renewal", "plan", "amc"],
    response:
      "For billing or renewal questions, our accounts team can help. Would you like to speak with a support executive?",
  },
  {
    id: "talk-to-person",
    label: "Talk to a person",
    keywords: ["person", "human", "agent", "executive", "support", "help me"],
    response: "__ESCALATE__",
  },
];

export const CHATBOT_FALLBACK =
  "I'm not sure I understood that. Would you like to talk to a support executive?";

export const CHATBOT_ESCALATING =
  "Connecting you to a support executive… Someone from our team will join shortly.";
