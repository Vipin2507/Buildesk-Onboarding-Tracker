import { Bell, Download, FileSpreadsheet, MoreHorizontal, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PaymentsHeader({
  accountCount,
  selectedCount,
  reminding,
  onSendReminders,
  onRemindExecutives,
  onExport,
  onBulkUpdate,
}: {
  accountCount: number;
  selectedCount: number;
  reminding: boolean;
  onSendReminders: () => void;
  onRemindExecutives: () => void;
  onExport: () => void;
  onBulkUpdate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="text-[11px] text-muted-foreground">
          Collections, overdue & reminders
          {accountCount > 0 ? (
            <span className="tabular-nums"> · {accountCount} accounts</span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-3 text-xs"
          disabled={selectedCount === 0 || reminding}
          onClick={onSendReminders}
        >
          <Bell className="h-3.5 w-3.5" />
          Send reminders
          {selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={onRemindExecutives}
        >
          <Users className="h-3.5 w-3.5" />
          Remind executives
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={onExport}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 w-8 rounded-lg p-0" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onBulkUpdate} className="gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk update
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
