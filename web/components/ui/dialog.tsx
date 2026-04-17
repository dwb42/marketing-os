"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={cn(
          "w-full max-w-3xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]",
          className,
        )}
      >
        {title ? (
          <div className="h-11 px-5 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Schließen"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
