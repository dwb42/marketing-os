"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AssetVersion } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export function AssetDiffViewer({
  open,
  onOpenChange,
  assetId,
  assetName,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assetId: string;
  assetName: string;
  workspaceId: string;
}) {
  const versionsQ = useQuery<AssetVersion[]>({
    queryKey: ["asset-versions", assetId, workspaceId],
    queryFn: () => api.assets.versions(assetId, workspaceId),
    enabled: open && !!workspaceId,
  });

  const versions = useMemo(
    () => (versionsQ.data ?? []).slice().sort((a, b) => a.versionNum - b.versionNum),
    [versionsQ.data],
  );

  // Auto-pick sensible defaults: second-to-last vs last
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  useEffect(() => {
    if (versions.length === 0) {
      setAId("");
      setBId("");
      return;
    }
    if (versions.length === 1) {
      setAId(versions[0].id);
      setBId(versions[0].id);
      return;
    }
    setAId(versions[versions.length - 2].id);
    setBId(versions[versions.length - 1].id);
  }, [versions]);

  const diffQ = useQuery({
    queryKey: ["asset-diff", assetId, workspaceId, aId, bId],
    queryFn: () => api.assets.diff(assetId, workspaceId, aId, bId),
    enabled: open && !!workspaceId && !!aId && !!bId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Asset-Diff · ${assetName}`}>
      <div className="p-5 space-y-4">
        {versionsQ.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : versions.length === 0 ? (
          <EmptyState title="Keine Versionen" />
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <VersionPicker
                label="Version A"
                value={aId}
                onChange={setAId}
                versions={versions}
              />
              <ArrowRight size={16} className="text-muted-foreground" />
              <VersionPicker
                label="Version B"
                value={bId}
                onChange={setBId}
                versions={versions}
              />
            </div>

            {diffQ.isError ? (
              <ErrorState error={diffQ.error} onRetry={() => diffQ.refetch()} />
            ) : diffQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : diffQ.data ? (
              <DiffView diff={diffQ.data} />
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

function VersionPicker({
  label,
  value,
  onChange,
  versions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  versions: AssetVersion[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[200px] text-xs"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.versionNum} · {v.status.toLowerCase()}
          </option>
        ))}
      </Select>
    </div>
  );
}

function DiffView({
  diff,
}: {
  diff: {
    a: { versionNum: number; status: string; contentHash: string };
    b: { versionNum: number; status: string; contentHash: string };
    diff: Record<string, { a: unknown; b: unknown; changed: boolean }>;
    identical: boolean;
  };
}) {
  const entries = Object.entries(diff.diff).sort((x, y) => {
    // changed ones first, then alphabetical
    if (x[1].changed !== y[1].changed) return x[1].changed ? -1 : 1;
    return x[0].localeCompare(y[0]);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">A</span>
          <span className="font-mono">v{diff.a.versionNum}</span>
          <StatusBadge status={diff.a.status} />
        </div>
        <ArrowRight size={12} className="text-muted-foreground" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">B</span>
          <span className="font-mono">v{diff.b.versionNum}</span>
          <StatusBadge status={diff.b.status} />
        </div>
        {diff.identical ? (
          <span className="ml-auto text-emerald-600 dark:text-emerald-400 text-[11px]">
            identisch
          </span>
        ) : null}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left font-medium px-3 py-2 w-32 text-[10px] uppercase tracking-wide text-muted-foreground">
                Feld
              </th>
              <th className="text-left font-medium px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                A (v{diff.a.versionNum})
              </th>
              <th className="text-left font-medium px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                B (v{diff.b.versionNum})
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, val]) => (
              <tr
                key={key}
                className={cn(
                  "border-b border-border last:border-0",
                  val.changed ? "bg-amber-500/5" : "",
                )}
              >
                <td
                  className={cn(
                    "px-3 py-2 font-mono align-top",
                    val.changed
                      ? "text-amber-700 dark:text-amber-400 font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {key}
                </td>
                <td className="px-3 py-2 align-top">
                  <FieldValue value={val.a} changed={val.changed} side="a" />
                </td>
                <td className="px-3 py-2 align-top">
                  <FieldValue value={val.b} changed={val.changed} side="b" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldValue({
  value,
  changed,
  side,
}: {
  value: unknown;
  changed: boolean;
  side: "a" | "b";
}) {
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground/60 italic">—</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {value.map((v, i) => (
          <li
            key={i}
            className={cn(
              "font-mono text-[11px]",
              changed
                ? side === "a"
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
            )}
          >
            {typeof v === "string" ? v : JSON.stringify(v)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className={cn("font-mono text-[11px] whitespace-pre-wrap break-all", changed ? (side === "a" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400") : "text-foreground")}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return (
    <span
      className={cn(
        "font-mono text-[11px]",
        changed
          ? side === "a"
            ? "text-red-600 dark:text-red-400"
            : "text-emerald-600 dark:text-emerald-400"
          : "text-foreground",
      )}
    >
      {String(value)}
    </span>
  );
}
