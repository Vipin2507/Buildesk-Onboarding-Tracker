import { CHATBOT_QUICK_REPLIES, type ChatbotQuickReply } from "@/data/chatbotResponses";

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function getBotResponse(text: string): string | null {
  const q = normalize(text);
  if (!q) return null;

  for (const item of CHATBOT_QUICK_REPLIES) {
    if (normalize(item.label) === q) return item.response;
    if (item.keywords.some((kw: string) => q.includes(kw))) return item.response;
  }

  return null;
}

export function matchQuickReplyLabel(label: string): string | null {
  const item: ChatbotQuickReply | undefined = CHATBOT_QUICK_REPLIES.find(
    (r: ChatbotQuickReply) => r.label === label,
  );
  return item?.response ?? null;
}
