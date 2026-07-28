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
    <div className={cn("mb-3 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-6", className)}>
      {cards.map((card) => (
        <div key={card.id} className="card-soft px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
            <CountUp to={card.value} />
            {card.suffix ? <span className="text-base font-medium">{card.suffix}</span> : null}
          </div>
          {card.hint ? <div className="mt-1 text-[11px] text-muted-foreground">{card.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
