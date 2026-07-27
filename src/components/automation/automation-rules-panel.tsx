import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Mail, MessageCircle, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTOMATION_TEMPLATE_VARS,
  AUTOMATION_TRIGGERS,
  type AutomationRule,
  type AutomationTrigger,
  type AutomationChannel,
} from "@/types/automation";
import {
  AUTOMATION_SAMPLE_VARS,
  renderAutomationTemplate,
} from "@/services/automationTemplate";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { notifyAutomationResult, testAutomationRule } from "@/services/automation";
import { formatRelativeTime } from "@/types/common";

const TRIGGER_LABEL = Object.fromEntries(AUTOMATION_TRIGGERS.map((t) => [t.value, t.label])) as Record<
  AutomationTrigger,
  string
>;

export function AutomationRulesPanel() {
  const rules = useAutomationStore((s) => s.rules);
  const addRule = useAutomationStore((s) => s.addRule);
  const updateRule = useAutomationStore((s) => s.updateRule);
  const deleteRule = useAutomationStore((s) => s.deleteRule);
  const toggleRule = useAutomationStore((s) => s.toggleRule);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger: "ticket-created" as AutomationTrigger,
    channel: "email" as AutomationChannel,
    isActive: true,
    templateSubject: "",
    templateBody: "",
  });

  const preview = useMemo(
    () => renderAutomationTemplate(form.templateBody, AUTOMATION_SAMPLE_VARS),
    [form.templateBody],
  );

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      trigger: "ticket-created",
      channel: "email",
      isActive: true,
      templateSubject: "Update for ticket {{ticketNumber}}",
      templateBody: "Hi {{customerName}},\n\nTicket {{ticketNumber}} — {{status}}\n{{ticketUrl}}",
    });
    setSheetOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      trigger: rule.trigger,
      channel: rule.channel,
      isActive: rule.isActive,
      templateSubject: rule.templateSubject ?? "",
      templateBody: rule.templateBody,
    });
    setSheetOpen(true);
  }

  function insertVariable(variable: string) {
    setForm((f) => ({ ...f, templateBody: `${f.templateBody}${variable}` }));
  }

  async function runRuleTest(rule: AutomationRule) {
    setTestingRuleId(rule.id);
    try {
      const log = await testAutomationRule(rule.id);
      if (!log) {
        toast.error("Test failed — endpoint not found");
        return;
      }
      notifyAutomationResult(log, rule.name);
    } finally {
      setTestingRuleId(null);
    }
  }

  function saveRule() {
    if (!form.name.trim() || !form.templateBody.trim()) {
      toast.error("Name and template body are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      trigger: form.trigger,
      channel: form.channel,
      isActive: form.isActive,
      templateSubject: form.channel === "email" ? form.templateSubject.trim() : undefined,
      templateBody: form.templateBody.trim(),
    };
    if (editing) {
      updateRule(editing.id, payload);
      toast.success("Rule updated");
    } else {
      addRule(payload);
      toast.success("Rule created");
    }
    setSheetOpen(false);
  }

  const columns: {
    key: string;
    header: string;
    sortable?: boolean;
    render: (r: AutomationRule) => ReactNode;
  }[] = [
    { key: "name", header: "Rule", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "trigger",
      header: "Trigger",
      render: (r) => TRIGGER_LABEL[r.trigger],
    },
    {
      key: "channel",
      header: "Channel",
      render: (r) => (
        <Pill tone={r.channel === "email" ? "info" : "success"} className="gap-1">
          {r.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
          {r.channel}
        </Pill>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (r) => (
        <Switch checked={r.isActive} size="sm" onCheckedChange={(v) => toggleRule(r.id, v === true)} />
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (r) => <span className="text-muted-foreground">{formatRelativeTime(r.updatedAt)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Automation rules</h3>
          <p className="text-sm text-muted-foreground">Email via n8n · WhatsApp via WAHA.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 bg-primary">
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      <DataTable
        data={rules}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={["name", "trigger", "channel"]}
        actions={(r) => (
          <>
            <Button
              size="icon"
              variant="ghost"
              title="Send test notification"
              disabled={testingRuleId === r.id}
              onClick={() => void runRuleTest(r)}
            >
              <Play className={testingRuleId === r.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditing(r);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>{editing ? "Edit rule" : "New automation rule"}</SheetTitle>
            <SheetDescription>Templates support variable chips below.</SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <Input
                placeholder="Rule name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value as AutomationTrigger })}
              >
                {AUTOMATION_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as AutomationChannel })}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {form.channel === "email" ? (
                <Input
                  placeholder="Email subject template"
                  value={form.templateSubject}
                  onChange={(e) => setForm({ ...form, templateSubject: e.target.value })}
                />
              ) : null}
              <Textarea
                rows={8}
                placeholder="Template body"
                value={form.templateBody}
                onChange={(e) => setForm({ ...form, templateBody: e.target.value })}
              />
              <div className="flex flex-wrap gap-1.5">
                {AUTOMATION_TEMPLATE_VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} size="sm" />
                Active
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={saveRule} className="flex-1 bg-primary">
                  {editing ? "Save changes" : "Create rule"}
                </Button>
                {editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    disabled={testingRuleId === editing.id}
                    onClick={() => void runRuleTest(editing)}
                  >
                    <Play className="h-4 w-4" /> Test send
                  </Button>
                ) : null}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="card-soft h-fit p-4"
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live preview
              </div>
              {form.channel === "email" && form.templateSubject ? (
                <div className="mb-2 text-sm font-medium">
                  Subject: {renderAutomationTemplate(form.templateSubject, AUTOMATION_SAMPLE_VARS)}
                </div>
              ) : null}
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{preview}</pre>
            </motion.div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete automation rule?"
        description={`Remove "${editing?.name}" — this cannot be undone.`}
        onConfirm={() => {
          if (editing) deleteRule(editing.id);
          toast.success("Rule deleted");
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
