/**
 * @deprecated Import from `@/data/chatbotKnowledge` for new code.
 * Re-exports kept for backward compatibility.
 */
export {
  CHATBOT_ESCALATING,
  CHATBOT_FALLBACK,
  CHATBOT_GREETING,
  CHATBOT_KNOWLEDGE,
  CHATBOT_QUICK_REPLY_LABELS,
  type ChatbotArticle,
  type ChatbotCategory,
} from "./chatbotKnowledge";

import { CHATBOT_KNOWLEDGE } from "./chatbotKnowledge";

export type ChatbotQuickReply = {
  id: string;
  label: string;
  keywords: string[];
  response: string;
};

/** @deprecated Use CHATBOT_KNOWLEDGE directly */
export const CHATBOT_QUICK_REPLIES: ChatbotQuickReply[] = CHATBOT_KNOWLEDGE.filter(
  (a) => a.quickReplyLabel,
).map((a) => ({
  id: a.id,
  label: a.quickReplyLabel!,
  keywords: a.keywords,
  response: a.response,
}));
