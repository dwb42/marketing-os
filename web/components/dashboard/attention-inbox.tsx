"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import type { Finding, SyncRun } from "@/lib/types";

export function AttentionInboxWidget({
  failedSyncs,
  openFindings,
  loading,
}: {
  failedSyncs: SyncRun[] | undefined;
  openFindings: Finding[] | undefined;
  loading?: boolean;
}) {
  const failed = failedSyncs ?? [];
  const open = openFindings ?? [];
  const isEmpty = !loading && failed.length === 0 && open.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aufmerksamkeit</CardTitle>
        <CardDescription>Was jetzt bearbeitet werden sollte</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="p-5 flex flex-col items-center gap-2 text-center py-10">
            <div className="size-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
            <div className="text-sm font-medium">Alles im grünen Bereich.</div>
            <div className="text-xs text-muted-foreground">
              Keine fehlgeschlagenen Syncs oder offenen Findings.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {failed.slice(0, 5).map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5 size-6 shrink-0 grid place-items-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-medium">Sync fehlgeschlagen</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                    {s.channel} · {s.type} · {s.targetId}
                  </div>
                  {s.errorMessage ? (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                      {s.errorMessage}
                    </div>
                  ) : null}
                </div>
                <RelativeTime
                  date={s.createdAt}
                  className="text-[11px] text-muted-foreground shrink-0"
                />
              </li>
            ))}
            {open.slice(0, 5).map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5 size-6 shrink-0 grid place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Lightbulb size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-medium line-clamp-1">{f.beobachtung}</span>
                    <StatusBadge status={f.konfidenz} />
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {f.empfehlung}
                  </div>
                  {f.modulBetroffen ? (
                    <div className="text-[11px] text-muted-foreground font-mono mt-1">
                      modul: {f.modulBetroffen}
                      {f.empfehlungAn ? ` · an: ${f.empfehlungAn}` : ""}
                    </div>
                  ) : null}
                </div>
                <RelativeTime
                  date={f.createdAt}
                  className="text-[11px] text-muted-foreground shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
        {!isEmpty && !loading ? (
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-4 text-xs">
            <Link href="/sync-runs" className="text-muted-foreground hover:text-foreground">
              Sync-Runs →
            </Link>
            <Link href="/findings" className="text-muted-foreground hover:text-foreground">
              Findings →
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
