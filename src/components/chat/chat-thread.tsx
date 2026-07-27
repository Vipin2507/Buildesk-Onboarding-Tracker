import { motion } from "framer-motion";
import { Bot, Headphones, UserRound } from "lucide-react";

import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Renders bot knowledge-base text: newlines + **bold** */
function ChatMessageBody({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function ChatThread({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {messages.map((m, i) => {
        const isCustomer = m.senderType === "customer";
        const isBot = m.senderType === "bot";
        const Icon = isBot ? Bot : isCustomer ? UserRound : Headphones;
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.12), ease: EASE }}
            className={cn("flex gap-2", isCustomer ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isCustomer ? "bg-primary/15 text-primary" : isBot ? "bg-muted text-muted-foreground" : "bg-info/15 text-info",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className={cn("max-w-[85%]", isCustomer ? "text-right" : "text-left")}>
              <div className="mb-0.5 text-[10px] text-muted-foreground">
                {m.senderName} · {formatDate(m.createdAt)}
              </div>
              <div
                className={cn(
                  "inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isCustomer
                    ? "rounded-tr-md bg-primary text-primary-foreground"
                    : "rounded-tl-md border bg-card",
                )}
              >
                <ChatMessageBody text={m.text} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
