import { isCrmIntegrationModule } from "@/data/crm-onboarding-defaults";

type ModuleRef = { key: string; label: string };

type Props = {
  subscribed: ModuleRef[];
  maxVisible?: number;
};

export function CrmAccountModulesCell({ subscribed }: Props) {
  if (subscribed.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }

  const core = subscribed.filter((m) => !isCrmIntegrationModule(m.key));
  const integrations = subscribed.filter((m) => isCrmIntegrationModule(m.key));

  function list(items: ModuleRef[]) {
    if (items.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>;
    return (
      <ul className="space-y-0.5 text-[11px] leading-snug text-foreground">
        {items.map((m) => (
          <li key={m.key} className="truncate">
            {m.label}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-w-[10rem] space-y-2">
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Modules ({core.length})
        </div>
        {list(core)}
      </div>
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Integrations ({integrations.length})
        </div>
        {list(integrations)}
      </div>
    </div>
  );
}
