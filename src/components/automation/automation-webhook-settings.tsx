import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_EMAIL_WEBHOOK,
  DEFAULT_HEALTH_WEBHOOK,
  DEFAULT_WAHA_API_KEY,
  DEFAULT_WAHA_API_URL,
  DEFAULT_WAHA_SESSION,
} from "@/data/automationDefaults";
import { useAutomationStore } from "@/stores/useAutomationStore";

export function AutomationWebhookSettings() {
  const endpoints = useAutomationStore((s) => s.endpoints);
  const waha = useAutomationStore((s) => s.waha);
  const healthCheck = useAutomationStore((s) => s.healthCheck);
  const setEndpointUrl = useAutomationStore((s) => s.setEndpointUrl);
  const setEndpointEnabled = useAutomationStore((s) => s.setEndpointEnabled);
  const setWahaConfig = useAutomationStore((s) => s.setWahaConfig);
  const setHealthCheckUrl = useAutomationStore((s) => s.setHealthCheckUrl);
  const setHealthCheckMethod = useAutomationStore((s) => s.setHealthCheckMethod);
  const restoreDefaultEndpoints = useAutomationStore((s) => s.restoreDefaultEndpoints);
  const restoreDefaultWaha = useAutomationStore((s) => s.restoreDefaultWaha);
  const restoreDefaultHealth = useAutomationStore((s) => s.restoreDefaultHealth);

  const emailEndpoint = endpoints.find((e) => e.channel === "email");
  const whatsappEndpoint = endpoints.find((e) => e.channel === "whatsapp");
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Integration settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Email uses n8n webhooks. WhatsApp uses WAHA — update credentials here without redeploying.
        </p>
      </div>

      {emailEndpoint ? (
        <div className="card-soft p-4">
          <div className="mb-1 font-medium">{emailEndpoint.label}</div>
          <p className="mb-2 text-xs text-muted-foreground">n8n webhook URL for outbound email</p>
          <Input
            value={emailEndpoint.webhookUrl}
            onChange={(e) => setEndpointUrl("email", e.target.value)}
            className="font-mono text-xs"
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <Switch
              checked={emailEndpoint.isEnabled}
              onCheckedChange={(v) => setEndpointEnabled("email", v)}
              size="sm"
            />
            Enabled
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toast.success("Email webhook saved")}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEndpointUrl("email", DEFAULT_EMAIL_WEBHOOK);
                toast.success("Email defaults restored");
              }}
            >
              Restore default
            </Button>
          </div>
        </div>
      ) : null}

      <div className="card-soft p-4">
        <div className="mb-1 font-medium">{whatsappEndpoint?.label ?? "WhatsApp (WAHA)"}</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Messages sent via <code className="rounded bg-muted px-1">POST /api/sendText</code>
        </p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">WAHA API URL</label>
            <Input
              value={waha.apiUrl}
              onChange={(e) => setWahaConfig({ apiUrl: e.target.value })}
              className="font-mono text-xs"
              placeholder="http://host:3000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={waha.apiKey}
                onChange={(e) => setWahaConfig({ apiKey: e.target.value })}
                className="font-mono text-xs"
              />
              <Button size="sm" variant="outline" type="button" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Session name</label>
            <Input
              value={waha.sessionName}
              onChange={(e) => setWahaConfig({ sessionName: e.target.value })}
              className="font-mono text-xs"
              placeholder="first"
            />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch checked={waha.isEnabled} onCheckedChange={(v) => setWahaConfig({ isEnabled: v })} size="sm" />
          WAHA enabled
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast.success("WAHA settings saved")}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              restoreDefaultWaha();
              toast.success("WAHA defaults restored");
            }}
          >
            Restore defaults
          </Button>
        </div>
      </div>

      <div className="card-soft p-4">
        <div className="mb-2 font-medium">{healthCheck.label}</div>
        <p className="mb-2 text-xs text-muted-foreground">n8n health ping (email pipeline)</p>
        <Input
          value={healthCheck.webhookUrl}
          onChange={(e) => setHealthCheckUrl(e.target.value)}
          className="mb-2 font-mono text-xs"
        />
        <select
          className="mb-2 h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={healthCheck.httpMethod}
          onChange={(e) => setHealthCheckMethod(e.target.value as "GET" | "POST")}
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast.success("Health check URL saved")}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
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
        onClick={() => {
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
