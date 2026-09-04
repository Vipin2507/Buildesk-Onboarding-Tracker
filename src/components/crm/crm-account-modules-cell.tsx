import { Pill } from "@/components/status-pill";

type ModuleChip = { key: string; label: string };

type Props = {
  modules: ModuleChip[];
  maxVisible?: number;
};

export function CrmAccountModulesCell({ modules, maxVisible = 2 }: Props) {
  if (modules.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const visible = modules.slice(0, maxVisible);
  const rest = modules.length - visible.length;
  const hiddenLabels = modules.slice(maxVisible).map((m) => m.label).join(", ");

  return (
    <div className="min-w-[9rem]">
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((mod) => (
          <Pill key={mod.key} tone="accent" title={mod.label}>
            {mod.label}
          </Pill>
        ))}
        {rest > 0 ? (
          <Pill tone="muted" title={hiddenLabels}>
            +{rest}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}
