import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Play, Send } from "lucide-react";
import { toast } from "sonner";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTOMATION_SAMPLE_VARS,
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import {
  notifyAutomationResult,
  testAutomationChannel,
  testAutomationRule,
} from "@/services/automation";
import { useAutomationStore } from "@/stores/useAutomationStore";
import type { AutomationChannel, AutomationRule } from "@/types/automation";
import { cn } from "@/lib/utils";

const TRIGGER_SHORT: Record<AutomationRule["trigger"], string> = {
  "ticket-created": "Created",
  "ticket-updated": "Updated",
  "ticket-closed": "Closed",
  "ticket-reply-from-team": "Team reply",
  "booking-created": "Booking request",
  "booking-status-changed": "Booking status",
  "task-before-start": "Task reminder",
};

export function AutomationTestPanel({ className }: { className?: string }) {
  const rules = useAutomationStore((s) => s.rules);
  const endpoints = useAutomationStore((s) => s.endpoints);

  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [customerEmail, setCustomerEmail] = useState("test@example.com");
  const [customerPhone, setCustomerPhone] = useState("+919999999999");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<"success" | "failed" | null>(null);

  const selectedRule = rules.find((r) => r.id === ruleId) ?? rules[0];

  const preview = useMemo(() => {
    if (!selectedRule) return null;
    const body = renderAutomationTemplate(selectedRule.templateBody, AUTOMATION_SAMPLE_VARS);
    const subject =
      selectedRule.channel === "email"
        ? renderAutomationSubject(selectedRule.templateSubject, AUTOMATION_SAMPLE_VARS)
        : null;
    return { subject, body };
  }, [selectedRule]);

  async function sendTest(mode: "rule" | AutomationChannel) {
    setSending(true);
    setLastResult(null);
    try {
      const overrides = { customerEmail, customerPhone };
      const log =
        mode === "rule" && selectedRule
          ? await testAutomationRule(selectedRule.id, overrides)
          : await testAutomationChannel(mode as AutomationChannel, overrides);

      if (!log) {
        toast.error("Could not run test — rule or endpoint missing");
        return;
      }

      setLastResult(log.status === "success" ? "success" : "failed");
      notifyAutomationResult(log, mode === "rule" ? selectedRule?.name ?? "Test" : `${mode} test`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
      setLastResult("failed");
    } finally {
      setSending(false);
    }
  }

  if (rules.length === 0) {
    return (
      <div className={cn("card-soft p-3 text-xs text-muted-foreground", className)}>
        Add an automation rule to send test notifications.
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: TICKET_EASE }}
      className={cn("card-soft p-3", className)}
    >
      <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Test automation</h3>
          <p className="text-[10px] text-muted-foreground">
            Send a sample payload — email via n8n, WhatsApp via WAHA. Logged under Logs.
          </p>
        </div>
        <AnimatePresence mode="wait">
          {lastResult ? (
            <motion.span
              key={lastResult}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                lastResult === "success"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              Last test: {lastResult === "success" ? "Success" : "Failed"}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-[10px] font-medium text-muted-foreground">Automation rule</label>
          <select
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            value={selectedRule?.id ?? ""}
            onChange={(e) => setRuleId(e.target.value)}
          >
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.channel} · {TRIGGER_SHORT[r.trigger]}
                {!r.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </select>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">Test email</label>
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="test@example.com"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">Test phone</label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91…"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs bg-primary"
              disabled={sending || !selectedRule}
              onClick={() => void sendTest("rule")}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send test (selected rule)
            </Button>
            {endpoints.map((ep) => (
              <Button
                key={ep.channel}
                variant="outline"
                size="sm"
                disabled={
                  sending ||
                  !ep.isEnabled ||
                  (ep.channel === "whatsapp" && !useAutomationStore.getState().waha.isEnabled)
                }
                onClick={() => void sendTest(ep.channel)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Play className="h-3 w-3" />
                Quick test · {ep.channel}
              </Button>
            ))}
          </div>
          {!selectedRule?.isActive ? (
            <p className="text-[10px] text-warning-foreground">
              Selected rule is inactive — test still sends if the channel endpoint is enabled.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border bg-muted/30 p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Payload preview
          </div>
          {preview && selectedRule?.channel === "email" && preview.subject ? (
            <div className="mb-1.5 text-xs font-medium">Subject: {preview.subject}</div>
          ) : null}
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-foreground/90">
            {preview ? `[TEST] ${preview.body}` : "—"}
          </pre>
        </div>
      </div>
    </motion.section>
  );
}
