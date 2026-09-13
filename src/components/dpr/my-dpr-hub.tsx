import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { DprStatStrip } from "@/components/dpr/dpr-stat-strip";
import { DprStatusBadge } from "@/components/dpr/dpr-status-badge";
import {
  DesignTicketPageHeader,
  DesignTicketSection,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dprSubcategoriesForCategory } from "@/data/dpr-catalog";
import {
  useCreateDprEntry,
  useCreateDprFromTemplate,
  useDprCategories,
  useDprDaySubmission,
  useDprEntries,
  useDprSummary,
  useDprTemplates,
  useSubmitDprDay,
  useUpdateDprEntry,
} from "@/hooks/use-dpr";
import { browserWallClockIso } from "@/lib/booking-slots";
import { formatDprTimeRange } from "@/lib/dpr-time";
import { formatDate } from "@/lib/utils";
import { useCompanyStore } from "@/stores/useCompanyStore";
import type { DprEntry, DprPriority, DprStatus } from "@/types/dpr";

function todayLocalDate() {
  return browserWallClockIso().slice(0, 10);
}

export function MyDprHub() {
  const entryDate = todayLocalDate();
  const listFilters = useMemo(
    () => ({ entryDate, executiveId: undefined, page: 1, pageSize: 500, sortBy: "entryDate" as const }),
    [entryDate],
  );

  const { data: categories } = useDprCategories();
  const { data: listData, isLoading } = useDprEntries(listFilters);
  const { data: summary } = useDprSummary(listFilters);
  const { data: submission } = useDprDaySubmission(entryDate);
  const companies = useCompanyStore((s) => s.companies);

  const createEntry = useCreateDprEntry(entryDate);
  const createFromTemplate = useCreateDprFromTemplate(entryDate);
  const updateEntry = useUpdateDprEntry(entryDate);
  const submitDay = useSubmitDprDay(entryDate);

  const [category, setCategory] = useState<string>("");
  const [subcategory, setSubcategory] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [clientFreeText, setClientFreeText] = useState("");
  const [useFreeTextClient, setUseFreeTextClient] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [priority, setPriority] = useState<DprPriority>("Medium");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [pendingEntry, setPendingEntry] = useState<DprEntry | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  const { data: templates } = useDprTemplates(category, subcategory);

  const subcategories = useMemo(
    () => dprSubcategoriesForCategory(categories, category),
    [categories, category],
  );

  const entries = listData?.items ?? [];
  const submitted = submission?.submitted === true;

  const grouped = useMemo(() => {
    const map = new Map<string, DprEntry[]>();
    for (const e of entries) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const stats = useMemo(
    () => [
      { id: "logged", label: "Logged today", value: summary?.loggedTodayCount ?? entries.length },
      { id: "done", label: "Completed", value: summary?.completedCount ?? 0, tone: "success" as const },
      { id: "pending", label: "Pending", value: summary?.pendingCount ?? 0, tone: "warning" as const },
      {
        id: "high",
        label: "High priority open",
        value: summary?.highPriorityOpenCount ?? 0,
        tone: "danger" as const,
      },
    ],
    [summary, entries.length],
  );

  async function handleQuickAdd() {
    if (!category || !subcategory || !taskName.trim()) {
      toast.error("Category, subcategory, and task name are required");
      return;
    }
    try {
      await createEntry.mutateAsync({
        entryDate,
        category,
        subcategory,
        taskName: taskName.trim(),
        priority,
        status: "In Progress",
        startTime: browserWallClockIso(),
        clientId: useFreeTextClient ? null : clientId || null,
        clientNameFreeText: useFreeTextClient ? clientFreeText.trim() || null : null,
      });
      setTaskName("");
      toast.success("Task logged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log task");
    }
  }

  async function handleTemplate(templateId: string) {
    try {
      await createFromTemplate.mutateAsync({
        templateId,
        entryDate,
        clientId: useFreeTextClient ? null : clientId || null,
        clientNameFreeText: useFreeTextClient ? clientFreeText.trim() || null : null,
      });
      toast.success("Checklist tasks created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create checklist");
    }
  }

  async function setStatus(entry: DprEntry, status: DprStatus) {
    if (status === "Pending") {
      setPendingEntry(entry);
      setPendingReason(entry.pendingReason ?? "");
      setNextFollowUpDate(entry.nextFollowUpDate ?? "");
      return;
    }
    try {
      await updateEntry.mutateAsync({ id: entry.id, status });
      toast.success(`Marked ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function savePending() {
    if (!pendingEntry) return;
    if (!pendingReason.trim()) {
      toast.error("Pending reason is required");
      return;
    }
    try {
      await updateEntry.mutateAsync({
        id: pendingEntry.id,
        status: "Pending",
        pendingReason: pendingReason.trim(),
        nextFollowUpDate: nextFollowUpDate || null,
      });
      setPendingEntry(null);
      toast.success("Marked Pending");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleSubmitDpr() {
    try {
      await submitDay.mutateAsync();
      toast.success("DPR submitted for today");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  }

  return (
    <div className="space-y-4">
      <DesignTicketPageHeader
        title={`Today's DPR · ${formatDate(entryDate)}`}
        subtitle="Log daily tasks by category. Submit when your day is captured — Completed tasks lock after submit; Pending tasks stay editable."
        actions={
          <Button
            size="sm"
            disabled={submitted || submitDay.isPending || entries.length === 0}
            onClick={() => void handleSubmitDpr()}
          >
            {submitted ? "Submitted" : submitDay.isPending ? "Submitting…" : "Submit DPR"}
          </Button>
        }
      />

      <DprStatStrip items={stats} />

      <DesignTicketSection title="Quick add">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Label className="flex min-h-[1rem] items-center text-xs">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setSubcategory("");
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories &&
                  Object.keys(categories).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Label className="flex min-h-[1rem] items-center text-xs">Subcategory</Label>
            <Select value={subcategory} onValueChange={setSubcategory} disabled={!category}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Subcategory" />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[160px] flex-[2] flex-col gap-1.5">
            <div className="flex min-h-[1rem] items-center justify-between gap-2">
              <Label className="text-xs">Client</Label>
              <button
                type="button"
                className="shrink-0 text-[10px] font-normal text-primary hover:underline"
                onClick={() => setUseFreeTextClient((v) => !v)}
              >
                {useFreeTextClient ? "Pick from companies" : "Use free text"}
              </button>
            </div>
            {useFreeTextClient ? (
              <Input
                className="h-8 text-xs"
                placeholder="Client name (free text)"
                value={clientFreeText}
                onChange={(e) => setClientFreeText(e.target.value)}
              />
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Search company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex min-w-[140px] flex-[2] flex-col gap-1.5">
            <Label className="flex min-h-[1rem] items-center text-xs">Task name</Label>
            <Input
              className="h-8 text-xs"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <div className="flex w-[100px] flex-col gap-1.5">
            <Label className="flex min-h-[1rem] items-center text-xs">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as DprPriority)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-8 gap-1"
            disabled={submitted || createEntry.isPending}
            onClick={() => void handleQuickAdd()}
          >
            <Plus className="h-3.5 w-3.5" /> Log task
          </Button>
        </div>
        {templates && templates.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <Button
                key={tpl.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={submitted || createFromTemplate.isPending}
                onClick={() => void handleTemplate(tpl.id)}
              >
                Use {tpl.templateName} checklist ({tpl.steps.length} steps)
              </Button>
            ))}
          </div>
        ) : null}
      </DesignTicketSection>

      <DesignTicketSection title="Today's tasks">
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks logged yet today.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([cat, items]) => {
              const open = collapsed[cat] !== true;
              return (
                <div key={cat} className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold"
                    onClick={() => setCollapsed((s) => ({ ...s, [cat]: open }))}
                  >
                    {cat}
                    <ChevronDown className={`h-4 w-4 transition ${open ? "" : "-rotate-90"}`} />
                  </button>
                  {open ? (
                    <ul className="divide-y border-t">
                      {items.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs sm:flex-nowrap"
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-medium">{entry.taskName}</span>
                            <span className="text-muted-foreground">
                              {entry.subcategory}
                              {entry.clientDisplayName ? ` · ${entry.clientDisplayName}` : ""}
                            </span>
                          </div>
                          <span className="text-muted-foreground tabular-nums">
                            {formatDprTimeRange(entry.startTime, entry.endTime)}
                          </span>
                          <DprStatusBadge status={entry.status} />
                          <Select
                            value={entry.status}
                            onValueChange={(v) => void setStatus(entry, v as DprStatus)}
                          >
                            <SelectTrigger className="h-7 w-[120px] text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="In Progress">In Progress</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DesignTicketSection>

      <Dialog open={Boolean(pendingEntry)} onOpenChange={(o) => !o && setPendingEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark task as Pending</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pending reason *</Label>
              <Textarea
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Next follow-up date</Label>
              <Input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={() => void savePending()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
