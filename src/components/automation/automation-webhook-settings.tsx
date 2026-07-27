import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_EMAIL_WEBHOOK,
  DEFAULT_HEALTH_WEBHOOK,
  DEFAULT_WHATSAPP_WEBHOOK,
} from "@/data/automationDefaults";
import { useAutomationStore } from "@/stores/useAutomationStore";

export function AutomationWebhookSettings() {
  const endpoints = useAutomationStore((s) => s.endpoints);
  const healthCheck = useAutomationStore((s) => s.healthCheck);
  const setEndpointUrl = useAutomationStore((s) => s.setEndpointUrl);
  const setHealthCheckUrl = useAutomationStore((s) => s.setHealthCheckUrl);
  const setHealthCheckMethod = useAutomationStore((s) => s.setHealthCheckMethod);
  const restoreDefaultEndpoints = useAutomationStore((s) => s.restoreDefaultEndpoints);
  const restoreDefaultHealth = useAutomationStore((s) => s.restoreDefaultHealth);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Webhook settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          n8n-powered today — update URLs here to swap providers without code changes.
        </p>
      </div>

      {endpoints.map((endpoint) => (
        <div key={endpoint.channel} className="card-soft p-4">
          <div className="mb-2 font-medium">{endpoint.label}</div>
          <Input
            value={endpoint.webhookUrl}
            onChange={(e) => setEndpointUrl(endpoint.channel, e.target.value)}
            className="font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => toast.success(`${endpoint.label} URL saved`)}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url =
                  endpoint.channel === "email" ? DEFAULT_EMAIL_WEBHOOK : DEFAULT_WHATSAPP_WEBHOOK;
                setEndpointUrl(endpoint.channel, url);
                toast.success("Restored default URL");
              }}
            >
              Restore default
            </Button>
          </div>
        </div>
      ))}

      <div className="card-soft p-4">
        <div className="mb-2 font-medium">{healthCheck.label}</div>
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

      <Button variant="outline" onClick={() => { restoreDefaultEndpoints(); restoreDefaultHealth(); toast.success("All defaults restored"); }}>
        Restore all defaults
      </Button>
    </div>
  );
}
