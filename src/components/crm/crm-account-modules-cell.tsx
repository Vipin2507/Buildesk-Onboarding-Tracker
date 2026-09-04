import { Pill } from "@/components/status-pill";

type ModuleChip = { key: string; label: string };

type Props = {
  modules: ModuleChip[];
};

export function CrmAccountModulesCell({ modules }: Props) {
  if (modules.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-[9rem]">
      <div className="flex flex-wrap items-center gap-1">
        {modules.map((mod) => (
          <Pill key={mod.key} tone="accent" title={mod.label}>
            {mod.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
