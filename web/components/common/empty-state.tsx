import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 px-6 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground mb-1">{icon}</div>
      ) : null}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description ? (
        <div className="text-xs text-muted-foreground max-w-md">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
