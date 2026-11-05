import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usagePatternLabel, usageTag, usageTagTone } from "@/lib/crm-usage";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import { cn } from "@/lib/utils";
import type {
  CrmUsageAccount,
  CrmUsageDay,
  CrmUsageDetail,
  CrmUsageScanRow,
} from "@/types/crm-usage";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function countText(value: number | null | undefined) {
  if (value == null) return "—";
  return String(value);
}

export function CrmUsageDetailSheet({
  account,
  scan,
  detail,
  days,
  from,
  to,
  loadingDetail,
  loadingDays,
  onOpenChange,
  onLoadDays,
}: {
  account: CrmUsageAccount | null;
  scan: CrmUsageScanRow | null;
  detail: CrmUsageDetail | null;
  days: CrmUsageDay[] | null;
  from: string;
  to: string;
  loadingDetail: boolean;
  loadingDays: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadDays: () => void;
}) {
  const open = Boolean(account);
  const summary = detail ?? scan;
  const tag = usageTag(summary);
  const maxBooking = Math.max(1, ...(detail?.bookingDaily.map((day) => day.count) ?? [1]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {account ? (
          <>
            <SheetHeader className="space-y-1 border-b border-border px-5 py-4 pr-12 text-left">
              <SheetTitle className="text-base">{account.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span>
                  {crmAccountStatusLabel(account.status)}
                  {account.city ? ` · ${account.city}` : ""}
                  {account.salesManagerName ? ` · ${account.salesManagerName}` : ""}
                </span>
                <Pill tone={usageTagTone(tag)}>{tag}</Pill>
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {from} to {to} · {account.licensedUsers || "—"} licensed users ·{" "}
                  {account.keySource === "portal"
                    ? "key on the account"
                    : account.keySource === "monitor"
                      ? "key from the health monitor catalog"
                      : "no API key"}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/crm/accounts/$accountId" params={{ accountId: account.id }}>
                    Open account
                  </Link>
                </Button>
              </div>

              {!account.connected ? (
                <p className="text-sm text-muted-foreground">
                  This account has no Buildesk dashboard key. Add the dashboard UUID as the portal
                  API key, or keep the account name matched in the health monitor catalog.
                </p>
              ) : loadingDetail && !summary ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading this account…
                </div>
              ) : summary && !summary.ok ? (
                <p className="text-sm text-destructive">{summary.error || "The report failed."}</p>
              ) : summary ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="Active users" value={`${summary.activeUsers}/${account.licensedUsers || "—"}`} />
                    <Metric label="Leads" value={String(summary.leads)} />
                    <Metric label="Follow-ups" value={String(summary.followups)} />
                    <Metric label="Bookings" value={countText(summary.bookings)} />
                    <Metric label="Visits scheduled" value={String(summary.visitsScheduled)} />
                    <Metric label="Visits conducted" value={String(summary.visitsConducted)} />
                    <Metric label="Calls" value={String(summary.calls)} />
                    <Metric label="Connected calls" value={String(summary.connectedCalls)} />
                  </div>
                  {summary.bookingWarning ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{summary.bookingWarning}</p>
                  ) : null}
                  {summary.callWarning ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{summary.callWarning}</p>
                  ) : null}

                  {detail?.bookingDaily.length ? (
                    <div>
                      <h3 className="mb-2 text-sm font-medium">Bookings by day</h3>
                      <div className="flex h-16 items-end gap-px">
                        {detail.bookingDaily.map((day) => (
                          <div
                            key={day.date}
                            title={`${day.date}: ${day.count}`}
                            className="min-w-0 flex-1 rounded-sm bg-primary/80"
                            style={{ height: `${Math.max(4, (day.count / maxBooking) * 100)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detail?.recommendations.length ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Customer success focus</h3>
                      {detail.recommendations.map((item) => (
                        <div key={item.finding} className="rounded-md border border-border px-3 py-2">
                          <div className="mb-1">
                            <Pill
                              tone={
                                item.priority === "High"
                                  ? "danger"
                                  : item.priority === "Medium"
                                    ? "warning"
                                    : "muted"
                              }
                            >
                              {item.priority}
                            </Pill>
                          </div>
                          <p className="text-sm font-medium">{item.finding}</p>
                          <p className="text-xs text-muted-foreground">{item.action}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div>
                    <h3 className="mb-1 text-sm font-medium">People</h3>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Person-level bookings come from the activity report. The account booking total
                      comes from the daywise booking report, so the two may not add up.
                    </p>
                    {detail?.executives.length ? (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[640px] text-left text-xs">
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                              {["Name", "Leads", "Follow-ups", "Visits", "Bookings", "Calls", "Connected"].map(
                                (label) => (
                                  <th key={label} className="px-2 py-1.5 font-medium">
                                    {label}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {detail.executives.map((person) => (
                              <tr key={person.name} className="border-t border-border">
                                <td className="px-2 py-1.5">
                                  <div className="font-medium">{person.name}</div>
                                  <div className={cn("text-[11px] text-muted-foreground")}>
                                    {person.leadOnly
                                      ? "Leads only"
                                      : person.productive
                                        ? person.team || "Active"
                                        : "No activity"}
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 tabular-nums">{person.leads}</td>
                                <td className="px-2 py-1.5 tabular-nums">{person.followups}</td>
                                <td className="px-2 py-1.5 tabular-nums">
                                  {person.visitsConducted}/{person.visitsScheduled}
                                </td>
                                <td className="px-2 py-1.5 tabular-nums">{person.bookings}</td>
                                <td className="px-2 py-1.5 tabular-nums">{person.calls}</td>
                                <td className="px-2 py-1.5 tabular-nums">{person.connectedCalls}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No executives were returned for this window.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">Daily CRM pattern</h3>
                      <Button variant="outline" size="sm" disabled={loadingDays} onClick={onLoadDays}>
                        {loadingDays ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Load daily pattern
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Each day is a separate report. This checks whether the team used CRM on that day,
                      not only the period total. Limited to 31 days.
                    </p>
                    {days ? (
                      <>
                        <Pill tone="accent">{usagePatternLabel(days)}</Pill>
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted/40 text-muted-foreground">
                              <tr>
                                {["Date", "CRM", "Leads", "Follow-ups", "Bookings", "Calls"].map((label) => (
                                  <th key={label} className="px-2 py-1.5 font-medium">
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {days.map((day) => (
                                <tr key={day.date} className="border-t border-border">
                                  <td className="px-2 py-1.5">{day.date}</td>
                                  <td className="px-2 py-1.5">
                                    {day.ok ? (day.hasCrmActivity ? "Used" : day.leadOnly ? "Leads only" : "No") : "Failed"}
                                  </td>
                                  <td className="px-2 py-1.5 tabular-nums">{day.ok ? day.leads : "—"}</td>
                                  <td className="px-2 py-1.5 tabular-nums">{day.ok ? day.followups : "—"}</td>
                                  <td className="px-2 py-1.5 tabular-nums">{countText(day.ok ? day.bookings : null)}</td>
                                  <td className="px-2 py-1.5 tabular-nums">{day.ok ? day.calls : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
