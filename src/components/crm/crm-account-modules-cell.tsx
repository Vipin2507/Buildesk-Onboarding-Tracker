import { Pill } from "@/components/status-pill";

type ModuleRef = { key: string; label: string };

type Props = {
  subscribed: ModuleRef[];
  maxVisible?: number;
};

export function CrmAccountModulesCell({ subscribed, maxVisible = 4 }: Props) {
  if (subscribed.length === 0) {
    return <span className="text-[10px] text-muted-foreground">None</span>;
  }

  const visible = subscribed.slice(0, maxVisible);
  const rest = subscribed.length - visible.length;

  return (
    <div className="min-w-[9rem]">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Subscribed ({subscribed.length})
      </div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        {visible.map((m) => (
          <Pill key={m.key} tone="success" className="text-[9px]">
            {m.label}
          </Pill>
        ))}
        {rest > 0 ? (
          <Pill tone="muted" className="text-[9px]">
            +{rest}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}
