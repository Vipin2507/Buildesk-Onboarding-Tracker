import { cn } from "@/lib/utils";
import type { CrmPaymentStatusTabId } from "@/lib/crm-payments-search";

export type PaymentStatusTabItem = {
  id: CrmPaymentStatusTabId;
  label: string;
  count: number;
};

export function PaymentsStatusTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: PaymentStatusTabItem[];
  active: CrmPaymentStatusTabId;
  onChange: (id: CrmPaymentStatusTabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "tabular-nums",
                isActive ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
