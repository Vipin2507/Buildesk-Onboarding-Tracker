import { Pill } from "@/components/status-pill";

type Props = {
  providers: string[];
  maxVisible?: number;
};

export function CrmAccountProvidersCell({ providers, maxVisible = 2 }: Props) {
  if (providers.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const visible = providers.slice(0, maxVisible);
  const rest = providers.length - visible.length;

  return (
    <div className="min-w-[9rem]">
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((provider) => (
          <Pill key={provider} tone="accent" title={provider}>
            {provider}
          </Pill>
        ))}
        {rest > 0 ? (
          <Pill tone="muted" title={providers.slice(maxVisible).join(", ")}>
            +{rest}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}
