"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { formatNumber, formatPercent } from "@/lib/format";
import { TrendingUp } from "lucide-react";

export function OutcomeFunnelWidget({
  funnel,
  loading,
  productSelected,
}: {
  funnel: Array<{ type: string; count: number }> | undefined;
  loading?: boolean;
  productSelected: boolean;
}) {
  const maxCount = funnel && funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Outcome-Funnel</CardTitle>
            <CardDescription>Letzte 14 Tage · nach Typ aggregiert</CardDescription>
          </div>
          <Link
            href="/outcomes"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Details →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : !productSelected ? (
          <EmptyState
            title="Kein Product ausgewählt"
            description="Wähle in den Einstellungen ein Product, um Outcomes zu sehen."
          />
        ) : !funnel || funnel.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            title="Noch keine Outcomes"
            description="Sobald Events eingehen, erscheinen sie hier."
          />
        ) : (
          <div className="space-y-2.5">
            {funnel.map((row, idx) => {
              const pct = row.count / maxCount;
              const conv =
                idx > 0 && funnel[idx - 1].count > 0
                  ? row.count / funnel[idx - 1].count
                  : null;
              return (
                <div key={row.type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{row.type}</span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">
                        {conv !== null ? `Conv ${formatPercent(conv, 0)}` : ""}
                      </span>
                      <span className="text-foreground font-semibold">
                        {formatNumber(row.count)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-sm transition-all"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
