import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, ChevronDown, FileSpreadsheet, Search, SlidersHorizontal, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { formatPaymentsInr } from "@/components/crm/payments/payments-format";
import { CountUp } from "@/components/count-up";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  TICKET_EASE,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { importCrmSeatSheets, listCrmSeatSheets } from "@/lib/api";
import { parseSeatSheet, seatEconomics, type SeatEconomics, type SeatSheetRow } from "@/lib/crm-seat-sheet";
import { isAdminRoleKey } from "@/lib/permissions";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/stores";

const GAIN = "#159947";
const LOSS = "#e11d48";
const FLAT = "#94a3b8";
const BRAND = "#009bff";

type Outcome = "all" | "gain" | "loss" | "flat" | "unpriced";
type Movement = "all" | "upgrade" | "degrade" | "both" | "still";
type SortKey = "net_desc" | "net_asc" | "gain_desc" | "loss_desc" | "per_user_desc" | "users_desc" | "name";
type RangeChoice = "any" | "d90" | "quarter" | "custom";

type ViewRow = SeatSheetRow & { economics: SeatEconomics };

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: "all", label: "All" },
  { id: "gain", label: "Net gain" },
  { id: "loss", label: "Net loss" },
  { id: "flat", label: "Flat" },
  { id: "unpriced", label: "No price" },
];

export function PaymentsSeatTab() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRoleKey(user?.role);
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [unmatched, setUnmatched] = useState<{ accountName: string; userId: string; reason: string }[]>(
    [],
  );
  const [queryText, setQueryText] = useState("");
  const [manager, setManager] = useState("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [movement, setMovement] = useState<Movement>("all");
  const [sortKey, setSortKey] = useState<SortKey>("net_desc");
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>("any");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);

  const query = useQuery({
    queryKey: ["crm-seat-sheets"],
    queryFn: () => listCrmSeatSheets(),
  });
  const rows = useMemo(
    () =>
      ((query.data?.rows ?? []) as SeatSheetRow[]).map((row) => ({
        ...row,
        economics: seatEconomics(row),
      })),
    [query.data?.rows],
  );

  const managers = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) names.add(managerName(row));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const scoped = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesQuery(row, queryText) &&
          (manager === "all" || managerName(row) === manager) &&
          inEndRange(row.endDate, from, to),
      ),
    [rows, queryText, manager, from, to],
  );

  const outcomeCounts = useMemo(() => countOutcomes(scoped), [scoped]);
  const movementCounts = useMemo(() => countMovement(scoped), [scoped]);

  const filtered = useMemo(() => {
    const next = scoped.filter(
      (row) => matchesOutcome(row, outcome) && matchesMovement(row, movement),
    );
    next.sort((a, b) => compareRows(a, b, sortKey));
    return next;
  }, [scoped, outcome, movement, sortKey]);

  const totals = useMemo(() => summarize(filtered), [filtered]);
  const managerChart = useMemo(() => managerBars(filtered), [filtered]);
  const monthChart = useMemo(() => monthBars(filtered), [filtered]);
  const movers = useMemo(() => topMovers(filtered), [filtered]);
  const largestGain = useMemo(
    () =>
      filtered
        .filter((row) => (row.economics.netValue ?? 0) > 0)
        .sort((a, b) => (b.economics.netValue ?? 0) - (a.economics.netValue ?? 0))
        .slice(0, 5),
    [filtered],
  );
  const largestLoss = useMemo(
    () =>
      filtered
        .filter((row) => (row.economics.netValue ?? 0) < 0)
        .sort((a, b) => (a.economics.netValue ?? 0) - (b.economics.netValue ?? 0))
        .slice(0, 5),
    [filtered],
  );

  const sheetFilterCount =
    (manager === "all" ? 0 : 1) +
    (outcome === "all" ? 0 : 1) +
    (movement === "all" ? 0 : 1) +
    (sortKey === "net_desc" ? 0 : 1) +
    (from || to ? 1 : 0);
  const activeFilterCount = sheetFilterCount + (queryText.trim() ? 1 : 0);
  const filterSummary = useMemo(() => {
    const bits: string[] = [];
    if (manager !== "all") bits.push(manager);
    const outcomeLabel = OUTCOMES.find((item) => item.id === outcome)?.label;
    if (outcome !== "all" && outcomeLabel) bits.push(outcomeLabel);
    if (movement === "upgrade") bits.push("Upgrades");
    else if (movement === "degrade") bits.push("Degrades");
    else if (movement === "both") bits.push("Both");
    else if (movement === "still") bits.push("No change");
    if (from || to) bits.push(`${from || "…"} – ${to || "…"}`);
    if (sortKey !== "net_desc") bits.push("Custom sort");
    return bits.length > 0 ? bits.join(" · ") : "Manager, seat change, license end";
  }, [manager, outcome, movement, from, to, sortKey]);

  function applyRange(choice: RangeChoice) {
    setRangeChoice(choice);
    if (choice === "any") {
      setFrom("");
      setTo("");
      return;
    }
    if (choice === "custom") return;
    const range = presetRange(choice);
    setFrom(range.from);
    setTo(range.to);
  }

  function clearFilters() {
    setQueryText("");
    setManager("all");
    setOutcome("all");
    setMovement("all");
    setSortKey("net_desc");
    setRangeChoice("any");
    setFrom("");
    setTo("");
  }

  async function onFile(file: File) {
    setUploading(true);
    try {
      const parsed = parseSeatSheet(await file.arrayBuffer());
      if (parsed.errors.length && parsed.rows.length === 0) {
        toast.error(parsed.errors[0] ?? "Could not read the sheet");
        return;
      }
      const result = await importCrmSeatSheets({ data: { rows: parsed.rows } });
      setUnmatched(result.unmatched);
      await queryClient.invalidateQueries({ queryKey: ["crm-seat-sheets"] });
      toast.success(
        `Saved ${result.saved} account${result.saved === 1 ? "" : "s"}. Collected payments were not changed.`,
      );
      if (parsed.errors.length) toast.error(parsed.errors[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const chartMotion = reduce ? 0 : 450;

  return (
    <motion.div
      variants={ticketPageVariants}
      initial="hidden"
      animate="show"
      className="space-y-3 py-3"
    >
      {rows.length > 0 ? (
        <Fold
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Filters"
          summary={filterSummary}
          badge={sheetFilterCount > 0 ? String(sheetFilterCount) : undefined}
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        >
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Seat outcome">
            {OUTCOMES.map((tab) => {
              const active = outcome === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setOutcome(tab.id)}
                  className={cn(
                    "relative inline-flex h-7 items-center gap-1 overflow-hidden rounded-full border px-2.5 text-[10px] font-medium max-md:min-h-11 max-md:px-3 max-md:text-xs",
                    active
                      ? "border-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="seat-outcome"
                      className="absolute inset-0 bg-primary"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", bounce: 0.16, duration: 0.42 }
                      }
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                  <span className={cn("relative z-10 tabular-nums", active ? "text-primary-foreground/90" : "text-muted-foreground")}>
                    {outcomeCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>
        <div className="grid grid-cols-2 items-end gap-x-2 gap-y-2 md:grid-cols-3 xl:grid-cols-6">
          <DesignTicketFilterField label="Sales manager" compact className="min-w-0">
            <DesignTicketSelect
              compact
              value={manager}
              onChange={setManager}
              options={[
                { value: "all", label: "All managers" },
                ...managers.map((name) => ({ value: name, label: name })),
              ]}
            />
          </DesignTicketFilterField>
          <DesignTicketFilterField label="Seat change" compact className="min-w-0">
            <DesignTicketSelect
              compact
              value={movement}
              onChange={(value) => setMovement(value as Movement)}
              options={[
                { value: "all", label: `Any change (${movementCounts.all})` },
                { value: "upgrade", label: `Upgrades (${movementCounts.upgrade})` },
                { value: "degrade", label: `Degrades (${movementCounts.degrade})` },
                { value: "both", label: `Both (${movementCounts.both})` },
                { value: "still", label: `No change (${movementCounts.still})` },
              ]}
            />
          </DesignTicketFilterField>
          <DesignTicketFilterField label="Sort" compact className="min-w-0">
            <DesignTicketSelect
              compact
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={[
                { value: "net_desc", label: "Net high → low" },
                { value: "net_asc", label: "Net low → high" },
                { value: "gain_desc", label: "Upgrade gain" },
                { value: "loss_desc", label: "Degrade loss" },
                { value: "per_user_desc", label: "Value per user" },
                { value: "users_desc", label: "Current users" },
                { value: "name", label: "Account A–Z" },
              ]}
            />
          </DesignTicketFilterField>
          <DesignTicketFilterField label="License ends" compact className="min-w-0">
            <DesignTicketSelect
              compact
              value={rangeChoice}
              onChange={(value) => applyRange(value as RangeChoice)}
              options={[
                { value: "any", label: "Any end date" },
                { value: "d90", label: "Next 90 days" },
                { value: "quarter", label: "This quarter" },
                { value: "custom", label: "Custom range" },
              ]}
            />
          </DesignTicketFilterField>
          <DesignTicketDateField
            compact
            label="From"
            className="min-w-0"
            value={from}
            onChange={(value) => {
              setRangeChoice("custom");
              setFrom(value);
            }}
          />
          <DesignTicketDateField
            compact
            label="To"
            className="min-w-0"
            value={to}
            onChange={(value) => {
              setRangeChoice("custom");
              setTo(value);
            }}
          />
        </div>
        </Fold>
      ) : null}

      {rows.length > 0 ? (
        <Fold
          open={chartsOpen}
          onOpenChange={setChartsOpen}
          title="Charts"
          summary={`${money(totals.deal)} current · ${money(totals.netValue)} net`}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        >
          <div className="space-y-2">
          <div className="grid items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Current deal"
              value={totals.deal}
              detail={`Previous ${money(totals.previous)} · after seat changes`}
              tone="text-foreground"
            />
            <Metric
              label="Value per user"
              value={totals.valuePerUser}
              detail={totals.users > 0 ? `Current deal ÷ ${totals.users} current users` : "No user counts"}
              tone="text-foreground"
            />
            <Metric
              label="Upgrade gain"
              value={totals.upgradeValue}
              detail={`${totals.upgradeSeats} seats added into the current deal`}
              tone="text-emerald-700 dark:text-emerald-400"
              active={movement === "upgrade"}
              onClick={() => setMovement((current) => (current === "upgrade" ? "all" : "upgrade"))}
            />
            <Metric
              label="Degrade loss"
              value={totals.degradeValue}
              detail={`Removed from the earlier deal · net ${money(totals.netValue)}`}
              tone="text-rose-700 dark:text-rose-400"
              active={movement === "degrade"}
              onClick={() => setMovement((current) => (current === "degrade" ? "all" : "degrade"))}
            />
          </div>

          <motion.div variants={ticketSectionVariants} className="grid items-stretch gap-2 lg:grid-cols-2">
            <section className="flex h-full flex-col rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold">Outcome mix</h3>
                <span className="text-right text-[10px] leading-tight text-muted-foreground">
                  {scoped.length} accounts
                </span>
              </div>
              <MixBar
                parts={[
                  { key: "gain", label: "Net gain", value: outcomeCounts.gain, color: GAIN },
                  { key: "loss", label: "Net loss", value: outcomeCounts.loss, color: LOSS },
                  { key: "flat", label: "Flat", value: outcomeCounts.flat, color: FLAT },
                  { key: "unpriced", label: "No price", value: outcomeCounts.unpriced, color: BRAND },
                ]}
              />
              <p className="mt-auto pt-2 text-[11px] leading-relaxed text-muted-foreground">
                {totals.upgradeSeats} seats upgraded · {totals.degradeSeats} seats degraded · net{" "}
                {signedSeats(totals.upgradeSeats - totals.degradeSeats)} seats
              </p>
            </section>

            <section className="flex h-full flex-col rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold">Seat movement</h3>
                <span className="text-[10px] text-muted-foreground">Upgrade vs degrade</span>
              </div>
              {totals.upgradeSeats + totals.degradeSeats === 0 ? (
                <p className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  No upgrade or degrade seats in this filter.
                </p>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <div className="relative h-28 w-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Upgrade", value: totals.upgradeSeats, fill: GAIN },
                            { name: "Degrade", value: totals.degradeSeats, fill: LOSS },
                          ].filter((item) => item.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={34}
                          outerRadius={50}
                          paddingAngle={3}
                          strokeWidth={0}
                          isAnimationActive={!reduce}
                          animationDuration={chartMotion}
                        >
                          {[
                            { name: "Upgrade", value: totals.upgradeSeats, fill: GAIN },
                            { name: "Degrade", value: totals.degradeSeats, fill: LOSS },
                          ]
                            .filter((item) => item.value > 0)
                            .map((item) => (
                              <Cell key={item.name} fill={item.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value} seats`, name]}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div
                        className={cn(
                          "text-base font-semibold tabular-nums leading-none",
                          totals.upgradeSeats - totals.degradeSeats > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : totals.upgradeSeats - totals.degradeSeats < 0
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-foreground",
                        )}
                      >
                        {signedSeats(totals.upgradeSeats - totals.degradeSeats)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">seats</div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-3 text-center text-sm font-semibold tabular-nums",
                      totals.netValue > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : totals.netValue < 0
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-foreground",
                    )}
                  >
                    {money(totals.netValue)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Net seat value</div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <LegendDot color={GAIN} label="Upgrade" />
                <LegendDot color={LOSS} label="Degrade" />
              </div>
            </section>
          </motion.div>

          <motion.div variants={ticketSectionVariants} className="grid items-stretch gap-2 lg:grid-cols-2">
            <ChartCard
              title="Gain and loss by sales manager"
              hint="Click a manager to filter"
              empty={managerChart.length === 0}
              emptyLabel="No priced seat movement in this filter."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={managerChart} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 10 }}
                    tickMargin={8}
                    height={48}
                    angle={-24}
                    textAnchor="end"
                    tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
                  />
                  <YAxis width={44} tick={{ fontSize: 10 }} tickFormatter={shortInr} />
                  <Tooltip formatter={(value: number) => formatPaymentsInr(value)} contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="gain"
                    name="Upgrade gain"
                    fill={GAIN}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduce}
                    animationDuration={chartMotion}
                    onClick={(state) => {
                      const name = barName(state);
                      if (!name || name === "Others") return;
                      setManager((current) => (current === name ? "all" : name));
                    }}
                  />
                  <Bar
                    dataKey="loss"
                    name="Degrade loss"
                    fill={LOSS}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduce}
                    animationDuration={chartMotion}
                    onClick={(state) => {
                      const name = barName(state);
                      if (!name || name === "Others") return;
                      setManager((current) => (current === name ? "all" : name));
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Seat value by license end"
              hint="Gain above zero, loss below"
              empty={monthChart.length === 0}
              emptyLabel="No end dates in this filter."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthChart} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickMargin={8} height={48} />
                  <YAxis width={44} tick={{ fontSize: 10 }} tickFormatter={shortInr} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatPaymentsInr(Math.abs(value)), name]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="gain"
                    name="Upgrade gain"
                    stackId="flow"
                    fill={GAIN}
                    isAnimationActive={!reduce}
                    animationDuration={chartMotion}
                  />
                  <Bar
                    dataKey="loss"
                    name="Degrade loss"
                    stackId="flow"
                    fill={LOSS}
                    isAnimationActive={!reduce}
                    animationDuration={chartMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div variants={ticketSectionVariants}>
            <ChartCard
              title="Largest seat moves"
              hint="Green is net gain, rose is net loss"
              empty={movers.length === 0}
              emptyLabel="No priced accounts in this filter."
              tall
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={movers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={shortInr} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
                  />
                  <Tooltip formatter={(value: number) => formatPaymentsInr(value)} contentStyle={tooltipStyle} />
                  <Bar dataKey="net" name="Net" radius={[0, 3, 3, 0]} isAnimationActive={!reduce} animationDuration={chartMotion}>
                    {movers.map((row) => (
                      <Cell key={row.id} fill={row.net >= 0 ? GAIN : LOSS} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div variants={ticketSectionVariants} className="grid items-stretch gap-2 lg:grid-cols-2">
            <AccountList
              title="Largest gains"
              empty="No upgrade gain in this filter."
              rows={largestGain.map((row) => ({
                id: row.accountId,
                name: row.accountName,
                primary: money(row.economics.netValue),
                secondary: `${row.economics.netSeats > 0 ? "+" : ""}${row.economics.netSeats} seats · ${money(row.economics.valuePerUser)} per user`,
                tone: "text-emerald-700 dark:text-emerald-400",
              }))}
            />
            <AccountList
              title="Largest losses"
              empty="No degrade loss in this filter."
              rows={largestLoss.map((row) => ({
                id: row.accountId,
                name: row.accountName,
                primary: money(row.economics.netValue),
                secondary: `${row.economics.netSeats} seats · ${money(row.economics.valuePerUser)} per user`,
                tone: "text-rose-700 dark:text-rose-400",
              }))}
            />
          </motion.div>
          </div>
        </Fold>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 w-full sm:min-w-[16rem] sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search account or user id…"
              aria-label="Search seat sheet"
              className="h-9 w-full pl-8 text-xs max-md:min-h-12 max-md:text-sm"
            />
          </div>
          {rows.length > 0 ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "account" : "accounts"}
            </span>
          ) : null}
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs text-muted-foreground"
              onClick={clearFilters}
            >
              Clear
            </Button>
          ) : null}
          {isAdmin ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <Button
                size="sm"
                className="h-9 shrink-0 gap-1.5 text-xs max-md:min-h-12"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </Button>
            </>
          ) : null}
        </div>

        {query.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl border bg-card" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No seat sheet yet. An admin can upload Account, User Id, Start date, End date, Deal value,
            Deal value with GST, Users, Upgrade, and Degrade. Deal value is the amount after the seat
            change. Users is the count before it.
          </div>
        ) : (
          <motion.div variants={ticketSectionVariants}>
              {filtered.length === 0 ? (
                <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  No accounts match these filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border bg-card">
                  <table className="w-full min-w-[72rem] text-left text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {[
                          "Account",
                          "User Id",
                          "Manager",
                          "Start",
                          "End",
                          "Current deal",
                          "Previous deal",
                          "With GST",
                          "Current users",
                          "Previous users",
                          "Upgrade",
                          "Degrade",
                          "Per user",
                          "Upgrade gain",
                          "Degrade loss",
                          "Net",
                        ].map((label) => (
                          <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr key={row.id} className="border-t transition-colors hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            <Link
                              to="/crm/accounts/$accountId"
                              params={{ accountId: row.accountId }}
                              className="hover:underline"
                            >
                              {row.accountName}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{row.userId || "—"}</td>
                          <td className="px-3 py-2">{managerName(row)}</td>
                          <td className="px-3 py-2">{row.startDate ? formatDate(row.startDate) : "—"}</td>
                          <td className="px-3 py-2">{row.endDate ? formatDate(row.endDate) : "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{money(row.dealValue)}</td>
                          <td className="px-3 py-2 tabular-nums">{money(row.economics.previousValue)}</td>
                          <td className="px-3 py-2 tabular-nums">{money(row.dealValueWithGst)}</td>
                          <td className="px-3 py-2 tabular-nums">{count(row.economics.currentUsers)}</td>
                          <td className="px-3 py-2 tabular-nums">{count(row.users)}</td>
                          <td className="px-3 py-2 tabular-nums">{count(row.upgrade)}</td>
                          <td className="px-3 py-2 tabular-nums">{count(row.degrade)}</td>
                          <td className="px-3 py-2 tabular-nums">{money(row.economics.valuePerUser)}</td>
                          <td className="px-3 py-2 tabular-nums text-emerald-700 dark:text-emerald-400">
                            {money(row.economics.upgradeValue)}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-rose-700 dark:text-rose-400">
                            {money(row.economics.degradeValue)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 font-medium tabular-nums",
                              (row.economics.netValue ?? 0) > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : (row.economics.netValue ?? 0) < 0
                                  ? "text-rose-700 dark:text-rose-400"
                                  : "",
                            )}
                          >
                            {money(row.economics.netValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </motion.div>
        )}
      </div>

      {unmatched.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
          <p className="font-medium">Not saved ({unmatched.length})</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {unmatched.slice(0, 12).map((item, index) => (
              <li key={`${item.userId}-${item.accountName}-${index}`}>
                {item.accountName || item.userId || "Row"} — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.div>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 8 };

function Fold({
  open,
  onOpenChange,
  title,
  summary,
  badge,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  badge?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {icon}
            </span>
            <span className="shrink-0 text-xs font-semibold">{title}</span>
            {badge ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
                {badge}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{summary}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="panel"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.32, ease: TICKET_EASE }}
              className="overflow-hidden"
            >
              <div className="space-y-2 border-t px-3 py-2.5">{children}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Collapsible>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | null;
  detail: string;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  const className = cn(
    "flex h-full min-w-0 flex-col rounded-xl border bg-card px-3 py-2 text-left transition-[border-color,box-shadow,transform] duration-300",
    onClick && !reduce && "hover:-translate-y-0.5 hover:border-primary/40",
    onClick && reduce && "hover:border-primary/40",
    active && "border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]",
  );
  const body = (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-base font-semibold leading-none tabular-nums", tone)}>
        {value == null ? (
          "—"
        ) : reduce ? (
          formatPaymentsInr(value)
        ) : (
          <CountUp to={value} format={(n) => formatPaymentsInr(Math.round(n))} />
        )}
      </div>
      <div className="mt-auto pt-2 text-[11px] leading-snug text-muted-foreground">{detail}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function MixBar({
  parts,
}: {
  parts: { key: string; label: string; value: number; color: string }[];
}) {
  const reduce = useReducedMotion();
  const total = Math.max(
    1,
    parts.reduce((sum, part) => sum + part.value, 0),
  );
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {parts.map((part) => (
          <motion.div
            key={part.key}
            className="h-full"
            style={{ background: part.color }}
            initial={false}
            animate={{ width: `${(part.value / total) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.45, ease: TICKET_EASE }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        {parts.map((part) => (
          <div key={part.key} className="min-w-[4.5rem]">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: part.color }} />
              {part.label}
            </div>
            <div className="mt-0.5 pl-3 text-sm font-semibold tabular-nums">{part.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  empty,
  emptyLabel,
  tall,
  children,
}: {
  title: string;
  hint?: string;
  empty: boolean;
  emptyLabel: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        {hint ? <span className="text-right text-[10px] leading-tight text-muted-foreground">{hint}</span> : null}
      </div>
      {empty ? (
        <p className="flex h-32 items-center justify-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className={cn("min-h-0", tall ? "h-52" : "h-44")}>{children}</div>
      )}
    </section>
  );
}

function AccountList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; primary: string; secondary: string; tone: string }[];
}) {
  return (
    <section className="flex h-full flex-col rounded-xl border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <Link
                  to="/crm/accounts/$accountId"
                  params={{ accountId: row.id }}
                  className="block truncate font-medium hover:underline"
                >
                  {row.name}
                </Link>
                <div className="text-[10px] text-muted-foreground">{row.secondary}</div>
              </div>
              <div className={cn("shrink-0 tabular-nums", row.tone)}>{row.primary}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function managerName(row: SeatSheetRow) {
  return row.salesManagerName?.trim() || "Unassigned";
}

function matchesQuery(row: SeatSheetRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.accountName.toLowerCase().includes(needle) ||
    row.userId.toLowerCase().includes(needle) ||
    managerName(row).toLowerCase().includes(needle)
  );
}

function inEndRange(endDate: string | null, from: string, to: string) {
  if (!from && !to) return true;
  const day = endDate?.slice(0, 10);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function outcomeOf(row: ViewRow): Exclude<Outcome, "all"> {
  const net = row.economics.netValue;
  if (net == null) return "unpriced";
  if (net > 0) return "gain";
  if (net < 0) return "loss";
  return "flat";
}

function matchesOutcome(row: ViewRow, outcome: Outcome) {
  return outcome === "all" || outcomeOf(row) === outcome;
}

function movementOf(row: ViewRow): Exclude<Movement, "all"> {
  const upgrade = row.upgrade ?? 0;
  const degrade = row.degrade ?? 0;
  if (upgrade > 0 && degrade > 0) return "both";
  if (upgrade > 0) return "upgrade";
  if (degrade > 0) return "degrade";
  return "still";
}

function matchesMovement(row: ViewRow, movement: Movement) {
  return movement === "all" || movementOf(row) === movement;
}

function countOutcomes(rows: ViewRow[]) {
  const counts: Record<Outcome, number> = { all: rows.length, gain: 0, loss: 0, flat: 0, unpriced: 0 };
  for (const row of rows) counts[outcomeOf(row)] += 1;
  return counts;
}

function countMovement(rows: ViewRow[]) {
  const counts: Record<Movement, number> = { all: rows.length, upgrade: 0, degrade: 0, both: 0, still: 0 };
  for (const row of rows) counts[movementOf(row)] += 1;
  return counts;
}

function compareRows(a: ViewRow, b: ViewRow, sortKey: SortKey) {
  const net = (row: ViewRow) => row.economics.netValue ?? Number.NEGATIVE_INFINITY;
  const gain = (row: ViewRow) => row.economics.upgradeValue ?? Number.NEGATIVE_INFINITY;
  const loss = (row: ViewRow) => row.economics.degradeValue ?? Number.NEGATIVE_INFINITY;
  const perUser = (row: ViewRow) => row.economics.valuePerUser ?? Number.NEGATIVE_INFINITY;
  if (sortKey === "name") return a.accountName.localeCompare(b.accountName);
  if (sortKey === "net_asc") return net(a) - net(b);
  if (sortKey === "gain_desc") return gain(b) - gain(a);
  if (sortKey === "loss_desc") return loss(b) - loss(a);
  if (sortKey === "per_user_desc") return perUser(b) - perUser(a);
  if (sortKey === "users_desc") return (b.economics.currentUsers ?? -1) - (a.economics.currentUsers ?? -1);
  return net(b) - net(a);
}

function summarize(rows: ViewRow[]) {
  let deal = 0;
  let previous = 0;
  let users = 0;
  let upgradeValue = 0;
  let degradeValue = 0;
  let netValue = 0;
  let upgradeSeats = 0;
  let degradeSeats = 0;
  let pricedUsers = 0;
  let pricedDeal = 0;
  for (const row of rows) {
    if (row.economics.base != null) deal += row.economics.base;
    if (row.economics.previousValue != null) previous += row.economics.previousValue;
    const currentUsers = row.economics.currentUsers;
    if (currentUsers != null && currentUsers > 0) users += currentUsers;
    upgradeValue += row.economics.upgradeValue ?? 0;
    degradeValue += row.economics.degradeValue ?? 0;
    netValue += row.economics.netValue ?? 0;
    upgradeSeats += row.upgrade ?? 0;
    degradeSeats += row.degrade ?? 0;
    if (row.economics.valuePerUser != null && currentUsers != null && currentUsers > 0 && row.economics.base != null) {
      pricedUsers += currentUsers;
      pricedDeal += row.economics.base;
    }
  }
  return {
    deal,
    previous,
    users,
    valuePerUser: pricedUsers > 0 ? Math.round((pricedDeal / pricedUsers) * 100) / 100 : null,
    upgradeValue,
    degradeValue,
    netValue,
    upgradeSeats,
    degradeSeats,
  };
}

function managerBars(rows: ViewRow[]) {
  const map = new Map<string, { gain: number; loss: number }>();
  for (const row of rows) {
    const name = managerName(row);
    const current = map.get(name) ?? { gain: 0, loss: 0 };
    current.gain += row.economics.upgradeValue ?? 0;
    current.loss += row.economics.degradeValue ?? 0;
    map.set(name, current);
  }
  const sorted = [...map.entries()]
    .map(([name, item]) => ({ name, gain: item.gain, loss: item.loss, total: item.gain + item.loss }))
    .sort((a, b) => b.total - a.total);
  if (sorted.length <= 8) return sorted.map(({ name, gain, loss }) => ({ name, gain, loss }));
  const head = sorted.slice(0, 7);
  const rest = sorted.slice(7);
  const others = rest.reduce(
    (sum, item) => ({ gain: sum.gain + item.gain, loss: sum.loss + item.loss }),
    { gain: 0, loss: 0 },
  );
  return [...head.map(({ name, gain, loss }) => ({ name, gain, loss })), { name: "Others", ...others }];
}

function monthBars(rows: ViewRow[]) {
  const map = new Map<string, { gain: number; loss: number }>();
  for (const row of rows) {
    const key = row.endDate?.slice(0, 7);
    if (!key || key.length < 7) continue;
    const current = map.get(key) ?? { gain: 0, loss: 0 };
    current.gain += row.economics.upgradeValue ?? 0;
    current.loss -= row.economics.degradeValue ?? 0;
    map.set(key, current);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, item]) => ({
      label: monthLabel(key),
      gain: item.gain,
      loss: item.loss,
    }));
}

function topMovers(rows: ViewRow[]) {
  return rows
    .filter((row) => row.economics.netValue != null && row.economics.netValue !== 0)
    .sort((a, b) => Math.abs(b.economics.netValue ?? 0) - Math.abs(a.economics.netValue ?? 0))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.accountName,
      net: row.economics.netValue ?? 0,
    }));
}

function money(value: number | null) {
  return value == null ? "—" : formatPaymentsInr(value);
}

function count(value: number | null) {
  return value == null ? "—" : String(value);
}

function signedSeats(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function shortInr(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 10000000) return `${sign}${Math.round(abs / 10000000)}Cr`;
  if (abs >= 100000) return `${sign}${Math.round(abs / 100000)}L`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function presetRange(choice: "d90" | "quarter") {
  const now = new Date();
  if (choice === "d90") {
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
    return { from: isoDate(now), to: isoDate(end) };
  }
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
  return { from: isoDate(start), to: isoDate(end) };
}

function barName(state: unknown) {
  if (!state || typeof state !== "object") return "";
  const record = state as { name?: unknown; payload?: { name?: unknown } };
  const name = record.payload?.name ?? record.name;
  return typeof name === "string" ? name : "";
}
