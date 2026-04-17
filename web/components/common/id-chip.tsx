"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncateId } from "@/lib/format";

export function IdChip({
  id,
  className,
  full = false,
}: {
  id: string;
  className?: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:border-border hover:text-foreground transition-colors",
        className,
      )}
      title={`Copy ${id}`}
    >
      <span>{full ? id : truncateId(id)}</span>
      {copied ? (
        <Check size={11} className="text-emerald-500" />
      ) : (
        <Copy
          size={11}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </button>
  );
}
