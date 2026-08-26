import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTOMATION_TRIGGERS,
  type AutomationChannel,
  type AutomationRule,
  type AutomationTrigger,
} from "@/types/automation";
import { CRM_AUTOMATION_TEMPLATE_VARS, CRM_AUTOMATION_SAMPLE_VARS, DEFAULT_TASK_REMINDER_OFFSET_MINUTES } from "@/data/crm-automation-defaults";
import {
  renderAutomationSubject,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { notifyCrmAutomationResult, testCrmAutomationRule } from "@/services/crm-automation";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type RuleFormState = {
  name: string;
  description: string;
  trigger: AutomationTrigger;
  channel: AutomationChannel;
  isActive: boolean;
  templateSubject: string;
  templateBody: string;
  emailCc: string;
  offsetMinutes: string;
  testEmail: string;
  testPhone: string;
};

const DEFAULT_FORM: RuleFormState = {
  name: "",
  description: "",
  trigger: "ticket-created",
  channel: "email",
  isActive: true,
  templateSubject: "Update for ticket {{ticketNumber}} — {{accountName}}",
  templateBody:
    "Hi {{customerName}},\n\nYour CRM support ticket {{ticketNumber}} for {{accountName}} has been updated.\n\nSubject: {{title}}\nStatus: {{status}}\nSales manager: {{salesManagerName}}\n\nView details: {{ticketUrl}}",
  emailCc: "",
  offsetMinutes: String(DEFAULT_TASK_REMINDER_OFFSET_MINUTES),
  testEmail: "test@example.com",
  testPhone: "+919999999999",
};

function ruleToForm(rule: AutomationRule): RuleFormState {
  return {
    name: rule.name,
    description: rule.description ?? "",
    trigger: rule.trigger,
    channel: rule.channel,
    isActive: rule.isActive,
    templateSubject: rule.templateSubject ?? "",
    templateBody: rule.templateBody,
    emailCc: rule.emailCc ?? "",
    offsetMinutes: String(rule.offsetMinutes ?? DEFAULT_TASK_REMINDER_OFFSET_MINUTES),
    testEmail: "test@example.com",
    testPhone: "+919999999999",
  };
}

function FormSection({
  title,
  description,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  description?: string;
  icon: typeof Mail;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: EASE }}
      className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-tight">{title}</h4>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.section>
  );
}

function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ChannelToggle({
  value,
  onChange,
}: {
  value: AutomationChannel;
  onChange: (channel: AutomationChannel) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/30 p-1">
      {(
        [
          { id: "email" as const, label: "Email", icon: Mail, hint: "n8n webhook" },
          { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle, hint: "WAHA direct" },
        ] as const
      ).map(({ id, label, icon: Icon, hint }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-3 py-2.5 text-center transition-all duration-200",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-primary")} />
            <span className="text-xs font-medium">{label}</span>
            <span className="text-[10px] opacity-70">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function VariableChips({
  onInsert,
  activeField,
  onActiveFieldChange,
  showSubject,
}: {
  onInsert: (variable: string) => void;
  activeField: "subject" | "body";
  onActiveFieldChange: (field: "subject" | "body") => void;
  showSubject: boolean;
}) {
  return (
    <div className="space-y-2">
      {showSubject ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Insert into:</span>
          {(["subject", "body"] as const).map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => onActiveFieldChange(field)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                activeField === field
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {field}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {CRM_AUTOMATION_TEMPLATE_VARS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onInsert(v)}
            className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[10px] transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewPanel({ form }: { form: RuleFormState }) {
  const globalCc = useCrmAutomationStore((s) => s.settings.emailCc);
  const previewBody = useMemo(
    () => renderAutomationTemplate(form.templateBody, CRM_AUTOMATION_SAMPLE_VARS),
    [form.templateBody],
  );
  const previewSubject = useMemo(
    () => renderAutomationSubject(form.templateSubject, CRM_AUTOMATION_SAMPLE_VARS),
    [form.templateSubject],
  );

  const mergedCc = [globalCc, form.emailCc]
    .flatMap((value) =>
      value
        ? value
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    )
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");

  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="lg:sticky lg:top-0"
    >
      <div className="overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Live preview
          </div>
        </div>
        <div className="space-y-3 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={form.channel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {form.channel === "email" ? (
                <Mail className="h-4 w-4 text-primary" />
              ) : (
                <MessageCircle className="h-4 w-4 text-success" />
              )}
              <span className="text-sm font-medium capitalize">{form.channel}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                sample data
              </span>
            </motion.div>
          </AnimatePresence>

          {form.channel === "email" ? (
            <div className="space-y-2 rounded-lg border border-border/50 bg-background/80 p-3 text-sm">
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">To</span>
                <div className="mt-0.5">{CRM_AUTOMATION_SAMPLE_VARS.customerName} &lt;customer@example.com&gt;</div>
              </div>
              {mergedCc ? (
                <div>
                  <span className="text-[10px] font-medium uppercase text-muted-foreground">CC</span>
                  <div className="mt-0.5 break-all text-muted-foreground">{mergedCc}</div>
                </div>
              ) : null}
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">Subject</span>
                <div className="mt-0.5 font-medium">{previewSubject || "—"}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 bg-background/80 p-3 text-sm">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">Recipient</span>
              <div className="mt-0.5 font-mono text-xs">919999999999@c.us</div>
            </div>
          )}

          <div className="rounded-lg border border-border/50 bg-background/80 p-3">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">Message</span>
            <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {previewBody || "Your message will appear here…"}
            </pre>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export function AutomationRuleDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AutomationRule | null;
  onSaved?: () => void;
}) {
  const addRule = useCrmAutomationStore((s) => s.addRule);
  const updateRule = useCrmAutomationStore((s) => s.updateRule);
  const globalCc = useCrmAutomationStore((s) => s.settings.emailCc);

  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const triggerLabel = AUTOMATION_TRIGGERS.find((t) => t.value === form.trigger)?.label ?? form.trigger;

  useEffect(() => {
    if (!open) return;
    setForm(editing ? ruleToForm(editing) : DEFAULT_FORM);
    setActiveField("body");
  }, [open, editing]);

  function insertVariable(variable: string) {
    if (activeField === "subject" && form.channel === "email") {
      setForm((f) => ({ ...f, templateSubject: `${f.templateSubject}${variable}` }));
      return;
    }
    setForm((f) => ({ ...f, templateBody: `${f.templateBody}${variable}` }));
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return false;
    }
    if (!form.templateBody.trim()) {
      toast.error("Message template is required");
      return false;
    }
    if (form.channel === "email" && !form.templateSubject.trim()) {
      toast.error("Email subject is required");
      return false;
    }
    if (form.trigger === "task-before-start") {
      const offset = Number(form.offsetMinutes);
      if (!Number.isFinite(offset) || offset <= 0) {
        toast.error("Reminder offset must be at least 1 minute");
        return false;
      }
    }
    return true;
  }

  function buildPayload() {
    const offsetMinutes =
      form.trigger === "task-before-start"
        ? Math.max(1, Math.round(Number(form.offsetMinutes) || DEFAULT_TASK_REMINDER_OFFSET_MINUTES))
        : undefined;
    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      trigger: form.trigger,
      channel: form.channel,
      isActive: form.isActive,
      templateSubject: form.channel === "email" ? form.templateSubject.trim() : undefined,
      templateBody: form.templateBody.trim(),
      emailCc: form.channel === "email" ? form.emailCc.trim() || undefined : undefined,
      offsetMinutes,
    };
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        updateRule(editing.id, payload);
        toast.success("Rule updated");
      } else {
        addRule(payload);
        toast.success("Rule created");
      }
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!validate()) return;
    setTesting(true);
    try {
      let ruleId = editing?.id;
      if (!ruleId) {
        const created = addRule(buildPayload());
        ruleId = created.id;
        toast.success("Rule saved — sending test…");
      }

      const log = await testCrmAutomationRule(ruleId, {
        customerEmail: form.testEmail,
        customerPhone: form.testPhone,
      });
      if (!log) {
        toast.error("Test failed — endpoint not found");
        return;
      }
      notifyCrmAutomationResult(log, form.name);
      onOpenChange(false);
      onSaved?.();
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {editing ? "Edit automation rule" : "Create automation rule"}
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl">
                Configure when and how notifications are sent. Email uses n8n; WhatsApp uses WAHA.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <FormSection
                title="Rule identity"
                description="Name and status for this automation."
                icon={FileText}
                delay={0}
              >
                <Field label="Rule name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ticket created — customer email"
                  />
                </Field>
                <Field label="Description" hint="Optional note for your team (not sent to customers).">
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Internal description"
                  />
                </Field>
                <label className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium">Active</div>
                    <div className="text-xs text-muted-foreground">Inactive rules are skipped when events fire</div>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    size="sm"
                  />
                </label>
              </FormSection>

              <FormSection
                title="Trigger & channel"
                description="Choose the ticket event and delivery channel."
                icon={Zap}
                delay={0.04}
              >
                <Field label="When this happens" required>
                  <Select
                    value={form.trigger}
                    onValueChange={(v) =>
                      setForm({ ...form, trigger: v as AutomationTrigger })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_TRIGGERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.trigger === "task-before-start" ? (
                  <Field
                    label="Send before task starts"
                    required
                    hint="Fixed lead time before the scheduled start (e.g. 15 = fifteen minutes before)."
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={form.offsetMinutes}
                        onChange={(e) => setForm({ ...form, offsetMinutes: e.target.value })}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                  </Field>
                ) : null}
                <Field label="Delivery channel" required>
                  <ChannelToggle
                    value={form.channel}
                    onChange={(channel) => setForm({ ...form, channel })}
                  />
                </Field>
                <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Fires on: <span className="font-medium text-foreground">{triggerLabel}</span>
                  {form.trigger === "task-before-start" ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-foreground">
                        {form.offsetMinutes || DEFAULT_TASK_REMINDER_OFFSET_MINUTES} min before start
                      </span>
                    </>
                  ) : null}
                </div>
              </FormSection>

              <AnimatePresence mode="wait">
                {form.channel === "email" ? (
                  <motion.div
                    key="email-options"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <FormSection
                      title="Email delivery"
                      description="Subject and CC recipients sent to n8n."
                      icon={AtSign}
                      delay={0}
                    >
                      <Field label="Email subject" required hint="Supports template variables.">
                        <Input
                          value={form.templateSubject}
                          onChange={(e) => setForm({ ...form, templateSubject: e.target.value })}
                          onFocus={() => setActiveField("subject")}
                          placeholder="Ticket {{ticketNumber}} — {{accountName}}"
                        />
                      </Field>
                      <Field
                        label="CC recipients"
                        hint={
                          globalCc
                            ? `Merged with global CC from settings: ${globalCc}`
                            : "Comma-separated addresses. Also set a global CC under Webhooks."
                        }
                      >
                        <Input
                          value={form.emailCc}
                          onChange={(e) => setForm({ ...form, emailCc: e.target.value })}
                          placeholder="manager@company.com, finance@company.com"
                          className="font-mono text-xs"
                        />
                      </Field>
                    </FormSection>
                  </motion.div>
                ) : (
                  <motion.div
                    key="whatsapp-options"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <FormSection
                      title="WhatsApp delivery"
                      description="Sent via WAHA to the assignee phone on their user profile."
                      icon={MessageCircle}
                      delay={0}
                    >
                      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                        {form.trigger === "task-before-start" ? (
                          <>
                            Recipient phone is taken from each task assignee&apos;s user profile when the
                            reminder runs.
                          </>
                        ) : (
                          <>
                            Recipient phone is taken from the company / portal contact when a ticket fires.
                            Numbers are normalized to India format (
                            <code className="rounded bg-muted px-1">91XXXXXXXXXX</code>) before sending.
                          </>
                        )}
                      </div>
                    </FormSection>
                  </motion.div>
                )}
              </AnimatePresence>

              <FormSection
                title="Message template"
                description="Body text with variable placeholders."
                icon={Mail}
                delay={0.08}
              >
                <Field label="Message body" required>
                  <Textarea
                    rows={8}
                    value={form.templateBody}
                    onChange={(e) => setForm({ ...form, templateBody: e.target.value })}
                    onFocus={() => setActiveField("body")}
                    placeholder="Hi {{customerName}}, …"
                    className="min-h-[160px] resize-y font-mono text-sm leading-relaxed"
                  />
                </Field>
                <VariableChips
                  onInsert={insertVariable}
                  activeField={activeField}
                  onActiveFieldChange={setActiveField}
                  showSubject={form.channel === "email"}
                />
              </FormSection>

              <FormSection
                title="Test recipients"
                description="Used when you click Test send (does not affect live ticket sends)."
                icon={Play}
                delay={0.12}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Test email">
                    <Input
                      type="email"
                      value={form.testEmail}
                      onChange={(e) => setForm({ ...form, testEmail: e.target.value })}
                      placeholder="test@example.com"
                      disabled={form.channel === "whatsapp"}
                      className={cn(form.channel === "whatsapp" && "opacity-50")}
                    />
                  </Field>
                  <Field label="Test phone">
                    <Input
                      value={form.testPhone}
                      onChange={(e) => setForm({ ...form, testPhone: e.target.value })}
                      placeholder="+919999999999"
                      disabled={form.channel === "email"}
                      className={cn(form.channel === "email" && "opacity-50")}
                    />
                  </Field>
                </div>
              </FormSection>
            </div>

            <div className="lg:col-span-2">
              <PreviewPanel form={form} />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={testing || saving}
              onClick={() => void handleTest()}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test send
            </Button>
            <Button
              type="button"
              className="min-w-[120px] gap-1.5 bg-primary"
              disabled={saving || testing}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create rule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
