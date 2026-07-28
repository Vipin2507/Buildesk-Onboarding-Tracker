import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Mail, MessageCircle, Pencil, Play, Plus, Power, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { AutomationRuleDialog } from "@/components/automation/automation-rule-dialog";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AUTOMATION_TRIGGERS,
  type AutomationRule,
  type AutomationTrigger,
} from "@/types/automation";
import { useAutomationStore } from "@/stores/useAutomationStore";
import { notifyAutomationResult, testAutomationRule } from "@/services/automation";
import { formatRelativeTime } from "@/types/common";
import { cn } from "@/lib/utils";

const TRIGGER_LABEL = Object.fromEntries(AUTOMATION_TRIGGERS.map((t) => [t.value, t.label])) as Record<
  AutomationTrigger,
  string
>;

export function AutomationRulesPanel() {
  const rules = useAutomationStore((s) => s.rules);
  const rulesEnabled = useAutomationStore((s) => s.settings.automationsEnabled);
  const setSettings = useAutomationStore((s) => s.setSettings);
  const deleteRule = useAutomationStore((s) => s.deleteRule);
  const toggleRule = useAutomationStore((s) => s.toggleRule);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule);
    setDialogOpen(true);
  }

  async function runRuleTest(rule: AutomationRule) {
    if (!rulesEnabled) {
      toast.info("Automation rules are paused", {
        description: "Turn on the master switch above to send test notifications.",
      });
      return;
    }
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

  const columns: {
    key: string;
    header: string;
    sortable?: boolean;
    render: (r: AutomationRule) => ReactNode;
  }[] = [
    {
      key: "name",
      header: "Rule",
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.name}</div>
          {r.description ? (
            <div className="truncate text-xs text-muted-foreground">{r.description}</div>
          ) : null}
        </div>
      ),
    },
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
      key: "emailCc",
      header: "CC",
      render: (r) =>
        r.channel === "email" && r.emailCc ? (
          <span className="max-w-[140px] truncate font-mono text-xs text-muted-foreground" title={r.emailCc}>
            {r.emailCc}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Switch checked={r.isActive} size="sm" onCheckedChange={(v) => toggleRule(r.id, v === true)} />
          {!rulesEnabled ? (
            <span className="text-xs text-muted-foreground">Paused</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (r) => <span className="text-muted-foreground">{formatRelativeTime(r.updatedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground">Automation rules</h2>
          <p className="text-[10px] text-muted-foreground">Email via n8n · WhatsApp via WAHA.</p>
        </div>
        <Button onClick={openCreate} size="sm" className="h-7 gap-1 px-2.5 text-xs bg-primary">
          <Plus className="h-3.5 w-3.5" /> New Rule
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "card-soft mb-2 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
          !rulesEnabled && "border-warning/40 bg-warning/5",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              rulesEnabled ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning-foreground",
            )}
          >
            <Power className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">Enable automation rules</div>
            <p className="mt-0.5 max-w-xl text-[10px] text-muted-foreground">
              {rulesEnabled
                ? "Rules that are turned on will run on ticket events."
                : "All rules are paused. Individual on/off settings are kept, but nothing will trigger until you turn this back on."}
            </p>
          </div>
        </div>
        <Switch
          checked={rulesEnabled}
          size="sm"
          onCheckedChange={(v) => {
            setSettings({ automationsEnabled: v === true });
            toast.success(v ? "Automation rules enabled" : "All automation rules paused");
          }}
        />
      </motion.div>

      {rules.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-soft flex flex-col items-center justify-center px-4 py-10 text-center"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold">No automation rules yet</h4>
          <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
            Create rules to notify customers by email or WhatsApp when tickets are created, updated, or closed.
          </p>
          <Button onClick={openCreate} size="sm" className="mt-4 gap-1 h-7 px-2.5 text-xs bg-primary">
            <Plus className="h-3.5 w-3.5" /> Create your first rule
          </Button>
        </motion.div>
      ) : (
        <div className={cn(!rulesEnabled && "opacity-80")}>
        <DataTable
          data={rules}
          columns={columns}
          getRowId={(r) => r.id}
          searchKeys={["name", "trigger", "channel", "description"]}
          actions={(r) => (
            <>
              <Button
                size="icon"
                variant="ghost"
                title={rulesEnabled ? "Send test notification" : "Turn on automation rules to test"}
                disabled={testingRuleId === r.id || !rulesEnabled}
                onClick={() => void runRuleTest(r)}
              >
                <Play className={testingRuleId === r.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              </Button>
              <Button size="icon" variant="ghost" title="Edit rule" onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Delete rule"
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
        </div>
      )}

      <AutomationRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />

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
