import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import {
  ticketFieldClass,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type Props = {
  users: Pick<User, "id" | "name">[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  modal?: boolean;
};

export function MultiAssigneeSelect({
  users,
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select assignees",
  modal = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedUsers = useMemo(
    () => users.filter((user) => value.includes(user.id)),
    [users, value],
  );

  const summary =
    selectedUsers.length === 0
      ? placeholder
      : selectedUsers.length === 1
        ? selectedUsers[0].name
        : `${selectedUsers.length} assignees selected`;

  function toggle(userId: string) {
    if (disabled) return;
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  }

  function remove(userId: string) {
    if (disabled) return;
    onChange(value.filter((id) => id !== userId));
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              ticketFieldClass,
              "h-8 w-full justify-between font-normal text-xs hover:bg-card dark:hover:bg-muted/40",
              !value.length && "text-muted-foreground",
            )}
          >
            <span className="truncate">{summary}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "w-[--radix-popover-trigger-width] p-0",
            modal && "z-[100]",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter>
            <CommandInput placeholder="Search users…" className="h-8 text-xs" />
            <CommandList className="max-h-52">
              <CommandEmpty className="py-4 text-xs">No users found</CommandEmpty>
              {users.map((user) => {
                const selected = value.includes(user.id);
                return (
                  <CommandItem
                    key={user.id}
                    value={user.name}
                    onSelect={() => toggle(user.id)}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        selected ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    {user.name}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-0.5 rounded-md border bg-muted/30 px-1.5 py-0.5 text-[10px]"
            >
              {user.name}
              {!disabled ? (
                <button
                  type="button"
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${user.name}`}
                  onClick={() => remove(user.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
