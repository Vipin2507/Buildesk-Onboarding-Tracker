import {
  Layers,
  Truck,
  HardHat,
  Smartphone,
  Building2,
  Boxes,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MODULE_CATALOG } from "@/data/module-catalog";
import type { ModuleKey } from "@/types";
import { ProgressRing } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICONS = {
  layers: Layers,
  truck: Truck,
  hardhat: HardHat,
  smartphone: Smartphone,
  building: Building2,
  boxes: Boxes,
} as const;

export function ModuleCard({
  companyId,
  moduleKey,
  label,
  optedIn,
  progressPercent,
}: {
  companyId: string;
  moduleKey: ModuleKey;
  label: string;
  optedIn: boolean;
  progressPercent: number;
}) {
  const navigate = useNavigate();
  const enableModule = useCompanyStore((s) => s.enableModule);
  const catalog = MODULE_CATALOG.find((m) => m.key === moduleKey);
  const Icon = ICONS[catalog?.icon ?? "layers"];

  function handleClick() {
    if (!optedIn) return;
    navigate({
      to: "/companies/$companyId/modules/$moduleKey",
      params: { companyId, moduleKey },
    });
  }

  function handleEnable(e: React.MouseEvent) {
    e.stopPropagation();
    enableModule(companyId, moduleKey);
    toast.success(`${label} enabled`);
  }

  const card = (
    <div
      role={optedIn ? "button" : undefined}
      tabIndex={optedIn ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (optedIn && (e.key === "Enter" || e.key === " ")) handleClick();
      }}
      className={cn(
        "card-soft flex flex-col gap-3 p-5 transition-all",
        optedIn
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          : "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <Pill tone={optedIn ? "success" : "muted"}>{optedIn ? "Opted In" : "Not Opted"}</Pill>
      </div>
      <div>
        <div className="font-semibold">{label}</div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {catalog?.description}
        </p>
      </div>
      {optedIn ? (
        <div className="mt-auto flex items-center gap-3 pt-1">
          <ProgressRing value={progressPercent} size={56} stroke={6} />
          <div className="text-xs text-muted-foreground">Module progress</div>
        </div>
      ) : (
        <div className="mt-auto pt-1">
          <Button size="sm" variant="outline" onClick={handleEnable}>
            Enable Module
          </Button>
        </div>
      )}
    </div>
  );

  if (optedIn) return card;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>Not purchased</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
