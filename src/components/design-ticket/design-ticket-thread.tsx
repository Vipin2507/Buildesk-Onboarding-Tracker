import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DesignTicket, DesignTicketMessage } from "@/types/design-ticket";
import { formatDate } from "@/lib/utils";

type ReplyProps = {
  placeholder?: string;
  onSend: (message: string, attachments: { name: string }[]) => void;
  disabled?: boolean;
};

type ThreadProps = {
  ticket: DesignTicket;
  mode: "internal" | "client";
  reply?: ReplyProps;
  contactName?: string;
  showResolvedBanner?: boolean;
};

function MessageBubble({ msg, isTeam }: { msg: DesignTicketMessage; isTeam: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isTeam ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isTeam
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-card text-foreground"
        }`}
      >
        <div className={`mb-1 flex items-center gap-2 text-xs ${isTeam ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          <span className="font-semibold">{msg.authorName}</span>
          <span>{formatDate(msg.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
        {msg.attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.attachments.map((file) => (
              <span
                key={file.name}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  isTeam ? "bg-primary-foreground/15" : "bg-muted"
                }`}
              >
                <Paperclip className="h-3 w-3" />
                {file.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function SystemEntry({ msg }: { msg: DesignTicketMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-center py-1"
    >
      <span className="rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
        {msg.message}
        <span className="ml-2 opacity-70">{formatDate(msg.createdAt)}</span>
      </span>
    </motion.div>
  );
}

export function DesignTicketThread({
  ticket,
  mode,
  reply,
  contactName,
  showResolvedBanner = true,
}: ThreadProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ name: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sorted = [...ticket.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages.length, ticket.status]);

  function handleSend() {
    if (!reply || !text.trim()) return;
    reply.onSend(text.trim(), files);
    setText("");
    setFiles([]);
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(e.target.files ?? []).map((f) => ({ name: f.name }));
    if (names.length) setFiles((prev) => [...prev, ...names]);
    e.target.value = "";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence>
        {showResolvedBanner && ticket.status === "resolved" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-center text-sm font-medium text-success"
          >
            This ticket is now Resolved — thank you for working with the Buildesk team.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-muted/20 p-4 min-h-[320px] max-h-[520px]">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. {mode === "client" ? "Our team will reply here soon." : "Waiting for client or team replies."}
          </p>
        ) : (
          sorted.map((msg) =>
            msg.kind === "system" ? (
              <SystemEntry key={msg.id} msg={msg} />
            ) : (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isTeam={msg.authorType === "team"}
              />
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      {reply && !reply.disabled ? (
        <div className="mt-4 space-y-2">
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  {f.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-card hover:bg-muted">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <input type="file" className="hidden" multiple onChange={onPickFiles} />
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={reply.placeholder ?? `Reply as ${contactName ?? "team"}…`}
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
            <Button type="button" className="shrink-0 gap-1.5" onClick={handleSend} disabled={!text.trim()}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
