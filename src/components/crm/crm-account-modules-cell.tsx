import { Pill } from "@/components/status-pill";

type ModuleRef = { key: string; label: string };

type Props = {
  subscribed: ModuleRef[];
  notSubscribed: ModuleRef[];
  maxVisible?: number;
};

function ModulePills({
  modules,
  tone,
  maxVisible,
}: {
  modules: ModuleRef[];
  tone: "success" | "muted";
  maxVisible: number;
}) {
  if (modules.length === 0) {
    return <span className="text-[10px] text-muted-foreground">None</span>;
  }
  const visible = modules.slice(0, maxVisible);
  const rest = modules.length - visible.length;
  return (
    <div className="flex flex-wrap gap-0.5">
      {visible.map((m) => (
        <Pill key={m.key} tone={tone} className="text-[9px]">
          {m.label}
        </Pill>
      ))}
      {rest > 0 ? (
        <Pill tone="muted" className="text-[9px]">
          +{rest}
        </Pill>
      ) : null}
    </div>
  );
}

export function CrmAccountModulesCell({
  subscribed,
  notSubscribed,
  maxVisible = 3,
}: Props) {
  return (
    <div className="min-w-[11rem] space-y-1.5">
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Subscribed ({subscribed.length})
        </div>
        <div className="mt-0.5">
          <ModulePills modules={subscribed} tone="success" maxVisible={maxVisible} />
        </div>
      </div>
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Not taken ({notSubscribed.length})
        </div>
        <div className="mt-0.5">
          <ModulePills modules={notSubscribed} tone="muted" maxVisible={maxVisible} />
        </div>
      </div>
    </div>
  );
}
