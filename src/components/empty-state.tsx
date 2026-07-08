import { AlertTriangle, Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {actionLabel && href && (
        <Button asChild className="mt-4 bg-primary hover:bg-primary/90">
          <Link to={href}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

export function EntityNotFound({
  entity,
  listPath,
  listLabel,
}: {
  entity: string;
  listPath: string;
  listLabel: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-warning" />
      <h2 className="text-xl font-semibold">{entity} not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This {entity.toLowerCase()} may have been removed or the link is incorrect.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link to={listPath as "/"}>{listLabel.startsWith("Back") ? listLabel : `Back to ${listLabel}`}</Link>
      </Button>
    </div>
  );
}
