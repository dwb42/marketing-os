"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, CheckSquare, Lightbulb, CheckCircle2 } from "lucide-react";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import {
  useFailedSyncs,
  useOpenFindings,
  usePendingApprovals,
} from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/common/relative-time";

/**
 * Persistent bell in the topbar: shows a count badge when there are open
 * items needing attention (failed syncs, pending approvals, open findings).
 * Clicking opens a popover listing the top items with direct links.
 */
export function AttentionIndicator() {
  const { workspaceId } = useSelectedWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const failedSyncs = useFailedSyncs(workspaceId);
  const openFindings = useOpenFindings(workspaceId);
  const pendingApprovals = usePendingApprovals(workspaceId);

  const failedCount = failedSyncs.data?.length ?? 0;
  const findingsCount = openFindings.data?.length ?? 0;
  const approvalsCount = pendingApprovals.data?.length ?? 0;
  const totalCount = failedCount + findingsCount + approvalsCount;

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!workspaceId) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={
          totalCount > 0
            ? `${totalCount} Dinge brauchen Aufmerksamkeit`
            : "Alles ruhig"
        }
        className={cn(
          "relative h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors",
          totalCount > 0 ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Bell size={16} />
        {totalCount > 0 ? (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold grid place-items-center tabular-nums">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-30 w-[360px] rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
          <div className="h-10 px-4 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aufmerksamkeit
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalCount}
            </span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {totalCount === 0 ? (
              <div className="p-6 flex flex-col items-center gap-2 text-center">
                <div className="size-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <div className="text-sm font-medium">Alles im grünen Bereich.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(failedSyncs.data ?? []).slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sync-runs?id=${s.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="mt-0.5 size-5 shrink-0 grid place-items-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                        <AlertTriangle size={10} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">
                          Sync fehlgeschlagen · {s.type}
                        </div>
                        {s.errorMessage ? (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {s.errorMessage}
                          </div>
                        ) : null}
                      </div>
                      <RelativeTime
                        date={s.createdAt}
                        className="text-[10px] text-muted-foreground shrink-0"
                      />
                    </Link>
                  </li>
                ))}
                {(pendingApprovals.data ?? []).slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/campaigns?id=${a.targetId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="mt-0.5 size-5 shrink-0 grid place-items-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <CheckSquare size={10} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">Approval offen</div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {a.targetType} · {a.targetId}
                        </div>
                      </div>
                      <RelativeTime
                        date={a.createdAt}
                        className="text-[10px] text-muted-foreground shrink-0"
                      />
                    </Link>
                  </li>
                ))}
                {(openFindings.data ?? []).slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <Link
                      href="/findings"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="mt-0.5 size-5 shrink-0 grid place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Lightbulb size={10} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium line-clamp-1">
                          {f.beobachtung}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {f.empfehlung}
                        </div>
                      </div>
                      <RelativeTime
                        date={f.createdAt}
                        className="text-[10px] text-muted-foreground shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {totalCount > 0 ? (
            <div className="h-9 px-4 border-t border-border flex items-center justify-end gap-3 text-[11px]">
              <Link
                href="/sync-runs?status=FAILED"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Syncs →
              </Link>
              <Link
                href="/findings"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Findings →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
