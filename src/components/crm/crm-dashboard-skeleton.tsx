import { motion } from "framer-motion";

import { Skeleton } from "@/components/ui/skeleton";
import { PageWrap } from "@/components/page-header";

const EASE = [0.22, 1, 0.36, 1] as const;

function Block({ delay = 0, className }: { delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: EASE }}
      className={className}
    >
      <Skeleton className="h-full w-full rounded-lg" />
    </motion.div>
  );
}

export function CrmDashboardSkeleton() {
  return (
    <PageWrap compact>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>

      <div className="space-y-2.5">
        <Block delay={0.02} className="card-soft h-[88px] p-2.5" />

        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} delay={0.04 + i * 0.02} className="h-[52px] rounded-lg border bg-card/60" />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Block key={i} delay={0.1 + i * 0.02} className="h-[52px] rounded-lg border bg-card/60" />
          ))}
        </div>

        <Block delay={0.12} className="card-soft h-[72px]" />

        <div className="grid gap-2.5 lg:grid-cols-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} delay={0.14 + i * 0.03} className="card-soft h-[168px] lg:col-span-3" />
          ))}
        </div>

        <div className="grid gap-2.5 lg:grid-cols-3">
          <Block delay={0.22} className="card-soft h-[280px] lg:col-span-2" />
          <Block delay={0.24} className="card-soft h-[280px]" />
        </div>
      </div>
    </PageWrap>
  );
}
