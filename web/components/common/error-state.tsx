"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle size={16} />
        <span className="font-medium">Fehler beim Laden</span>
      </div>
      <div className="text-xs text-muted-foreground font-mono">{message}</div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Nochmal versuchen
        </Button>
      ) : null}
    </div>
  );
}
