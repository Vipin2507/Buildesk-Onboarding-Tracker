import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

export type SummaryCard = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
};

export function ProgressSummaryCards({
  cards,
  className,
}: {
  cards: SummaryCard[];
  className?: string;
}) {
  return (
    <div className={cn("mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>
      {cards.map((card) => (
        <div key={card.id} className="card-soft p-3 sm:p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </div>
          <div className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">
            <CountUp to={card.value} />
            {card.suffix ? <span className="text-base font-medium">{card.suffix}</span> : null}
          </div>
          {card.hint ? <div className="mt-1 text-[11px] text-muted-foreground">{card.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
