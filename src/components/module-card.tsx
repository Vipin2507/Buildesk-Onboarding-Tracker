import {
  Layers,
  Truck,
  HardHat,
  Smartphone,
  Building2,
  Boxes,
  Users,
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
  users: Users,
} as const;

export function ModuleCard({
  companyId,
  moduleKey,
  label,
  optedIn,
  progressPercent,
  isLive = false,
}: {
  companyId: string;
  moduleKey: ModuleKey;
  label: string;
  optedIn: boolean;
  progressPercent: number;
  isLive?: boolean;
}) {
  const navigate = useNavigate();
  const enableModule = useCompanyStore((s) => s.enableModule);
  const disableModule = useCompanyStore((s) => s.disableModule);
  const setModuleLive = useCompanyStore((s) => s.setModuleLive);
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

  function handleDisable(e: React.MouseEvent) {
    e.stopPropagation();
    disableModule(companyId, moduleKey);
    toast.success(`${label} removed from company`);
  }

  function handleLive(e: React.MouseEvent) {
    e.stopPropagation();
    setModuleLive(companyId, moduleKey, !isLive);
    toast.success(isLive ? `${label} marked Not Live` : `${label} is Live`);
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
        "card-soft flex min-w-0 flex-col gap-2 p-3 transition-all",
        optedIn
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          : "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Pill tone={optedIn ? "success" : "muted"}>{optedIn ? "Opted In" : "Not Opted"}</Pill>
          {optedIn ? (
            <Pill tone={isLive ? "success" : "muted"}>{isLive ? "Live" : "Not Live"}</Pill>
          ) : null}
        </div>
      </div>
      <div>
        <div className="truncate text-sm font-semibold">{label}</div>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
          {catalog?.description}
        </p>
      </div>
      {optedIn ? (
        <div className="mt-auto space-y-1.5 pt-0.5">
          <div className="flex items-center gap-2.5">
            <ProgressRing value={progressPercent} size={48} className="shrink-0" />
            <div className="text-[10px] text-muted-foreground">Module progress</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleLive}>
              {isLive ? "Clear Live" : "Mark Live"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={handleDisable}>
              Disable
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-0.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEnable}>
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
