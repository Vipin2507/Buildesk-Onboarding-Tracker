import { cn } from "@/lib/utils";
import type { User } from "@/types";

type Props = {
  users: Pick<User, "id" | "name">[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
};

export function MultiAssigneeSelect({ users, value, onChange, disabled, className }: Props) {
  const allSelected = users.length > 0 && users.every((u) => value.includes(u.id));

  function toggle(userId: string) {
    if (disabled) return;
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  }

  function toggleAll() {
    if (disabled) return;
    onChange(allSelected ? [] : users.map((u) => u.id));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="rounded border"
          checked={allSelected}
          disabled={disabled || users.length === 0}
          onChange={toggleAll}
        />
        <span className="font-medium">Select all users</span>
      </label>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
        {users.map((user) => (
          <label key={user.id} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="rounded border"
              checked={value.includes(user.id)}
              disabled={disabled}
              onChange={() => toggle(user.id)}
            />
            <span>{user.name}</span>
          </label>
        ))}
        {users.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No assignable users</p>
        ) : null}
      </div>
      {value.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">{value.length} assignee(s) selected</p>
      ) : null}
    </div>
  );
}
