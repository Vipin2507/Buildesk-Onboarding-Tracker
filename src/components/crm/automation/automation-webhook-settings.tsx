import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DesignTicketSection } from "@/components/design-ticket/design-ticket-shared";
import {
  DEFAULT_WAHA_API_KEY,
  DEFAULT_WAHA_API_URL,
  DEFAULT_WAHA_SESSION,
  N8N_EMAIL_SEGMENT,
  N8N_HEALTH_SEGMENT,
} from "@/data/automationDefaults";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";

export function AutomationWebhookSettings() {
  const settings = useCrmAutomationStore((s) => s.settings);
  const endpoints = useCrmAutomationStore((s) => s.endpoints);
  const waha = useCrmAutomationStore((s) => s.waha);
  const healthCheck = useCrmAutomationStore((s) => s.healthCheck);
  const setSettings = useCrmAutomationStore((s) => s.setSettings);
  const setEndpointEnabled = useCrmAutomationStore((s) => s.setEndpointEnabled);
  const setWahaConfig = useCrmAutomationStore((s) => s.setWahaConfig);
  const setHealthCheckMethod = useCrmAutomationStore((s) => s.setHealthCheckMethod);
  const restoreDefaultSettings = useCrmAutomationStore((s) => s.restoreDefaultSettings);
  const restoreDefaultWaha = useCrmAutomationStore((s) => s.restoreDefaultWaha);
  const restoreDefaultHealth = useCrmAutomationStore((s) => s.restoreDefaultHealth);
  const restoreDefaultEndpoints = useCrmAutomationStore((s) => s.restoreDefaultEndpoints);

  const emailEndpoint = endpoints.find((e) => e.channel === "email");
  const whatsappEndpoint = endpoints.find((e) => e.channel === "whatsapp");
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-2">
      <DesignTicketSection compact title="Integration settings">
        <p className="text-[10px] text-muted-foreground -mt-1">
          Email via n8n webhooks (<code className="rounded bg-muted px-1">{N8N_EMAIL_SEGMENT}</code>
          ). WhatsApp via WAHA direct.
        </p>
      </DesignTicketSection>

      <div className="card-soft p-3">
        <label className="flex items-center justify-between gap-2 text-xs">
          <div>
            <div className="font-medium">Automations enabled</div>
            <div className="text-[10px] text-muted-foreground">Master kill switch — disables all sends</div>
          </div>
          <Switch
            checked={settings.automationsEnabled}
            onCheckedChange={(v) => setSettings({ automationsEnabled: v })}
            size="sm"
          />
        </label>
      </div>

      <div className="card-soft p-3">
        <div className="mb-1 text-sm font-medium">{emailEndpoint?.label ?? "Email (n8n)"}</div>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Webhook base — app appends segment <code className="rounded bg-muted px-1">{N8N_EMAIL_SEGMENT}</code>
        </p>
        <Input
          value={settings.n8nWebhookBase}
          onChange={(e) => setSettings({ n8nWebhookBase: e.target.value })}
          className="h-8 font-mono text-xs"
          placeholder="http://host:5678/webhook"
        />
        <div className="mt-2">
          <label className="mb-1 block text-[10px] text-muted-foreground">Global email CC (optional)</label>
          <Input
            value={settings.emailCc ?? ""}
            onChange={(e) => setSettings({ emailCc: e.target.value })}
            className="h-8 font-mono text-xs"
            placeholder="manager@company.com"
          />
        </div>
        {emailEndpoint ? (
          <label className="mt-2.5 flex items-center gap-1.5 text-xs">
            <Switch
              checked={emailEndpoint.isEnabled}
              onCheckedChange={(v) => setEndpointEnabled("email", v)}
              size="sm"
            />
            Email channel enabled
          </label>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => toast.success("n8n settings saved")}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => {
              restoreDefaultSettings();
              toast.success("n8n defaults restored");
            }}
          >
            Restore defaults
          </Button>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="mb-1 text-sm font-medium">{whatsappEndpoint?.label ?? "WhatsApp (WAHA)"}</div>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Text messages via <code className="rounded bg-muted px-1">POST /api/sendText</code>
        </p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">WAHA API URL</label>
            <Input
              value={waha.apiUrl}
              onChange={(e) => setWahaConfig({ apiUrl: e.target.value })}
              className="h-8 font-mono text-xs"
              placeholder={DEFAULT_WAHA_API_URL}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">API Key</label>
            <div className="flex gap-1.5">
              <Input
                type={showApiKey ? "text" : "password"}
                value={waha.apiKey}
                onChange={(e) => setWahaConfig({ apiKey: e.target.value })}
                className="h-8 font-mono text-xs"
                placeholder={DEFAULT_WAHA_API_KEY}
              />
              <Button size="sm" variant="outline" type="button" className="h-8 px-2 text-xs" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">Session name</label>
            <Input
              value={waha.sessionName}
              onChange={(e) => setWahaConfig({ sessionName: e.target.value })}
              className="h-8 font-mono text-xs"
              placeholder={DEFAULT_WAHA_SESSION}
            />
          </div>
        </div>
        <label className="mt-2.5 flex items-center gap-1.5 text-xs">
          <Switch checked={waha.isEnabled} onCheckedChange={(v) => setWahaConfig({ isEnabled: v })} size="sm" />
          WAHA enabled
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => toast.success("WAHA settings saved")}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => {
              restoreDefaultWaha();
              toast.success("WAHA defaults restored");
            }}
          >
            Restore defaults
          </Button>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="mb-1 text-sm font-medium">{healthCheck.label}</div>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Pings <code className="rounded bg-muted px-1">{N8N_HEALTH_SEGMENT}</code> under the n8n webhook base
        </p>
        <select
          className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
          value={healthCheck.httpMethod}
          onChange={(e) => setHealthCheckMethod(e.target.value as "GET" | "POST")}
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => toast.success("Health check method saved")}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => {
              restoreDefaultHealth();
              toast.success("Health check defaults restored");
            }}
          >
            Restore default
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          restoreDefaultSettings();
          restoreDefaultEndpoints();
          restoreDefaultWaha();
          restoreDefaultHealth();
          toast.success("All integration defaults restored");
        }}
      >
        Restore all defaults
      </Button>
    </div>
  );
}
