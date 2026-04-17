"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./sparkline";
import { formatNumber, formatMoneyFromMicros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface KpiTileProps {
  label: string;
  value: string;
  delta?: number | null;
  series: number[];
  loading?: boolean;
  accent?: "default" | "success" | "warning" | "info";
}

function KpiTile({ label, value, delta, series, loading, accent = "default" }: KpiTileProps) {
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const deltaClass =
    deltaSign > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : deltaSign < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  const strokeClass =
    accent === "info"
      ? "stroke-blue-500"
      : accent === "success"
        ? "stroke-emerald-500"
        : accent === "warning"
          ? "stroke-amber-500"
          : "stroke-primary";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        {delta !== null && delta !== undefined && !loading ? (
          <div className={cn("text-[11px] font-medium flex items-center gap-0.5", deltaClass)}>
            {deltaSign > 0 ? (
              <ArrowUpRight size={12} />
            ) : deltaSign < 0 ? (
              <ArrowDownRight size={12} />
            ) : (
              <Minus size={12} />
            )}
            {Math.abs(delta).toFixed(0)}%
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24 mt-2" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight tabular-nums mt-1">
          {value}
        </div>
      )}
      <div className="mt-3 h-8 -mx-1">
        {loading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <Sparkline values={series} className={strokeClass} />
        )}
      </div>
    </Card>
  );
}

export function KpiStrip({
  totals,
  series,
  funnelChatStarts,
  loading,
}: {
  totals: { impressions: number; clicks: number; costMicros: number };
  series: Array<{ date: string; impressions: number; clicks: number; costMicros: number }>;
  funnelChatStarts: number;
  loading?: boolean;
}) {
  const impressionsSeries = series.map((s) => s.impressions);
  const clicksSeries = series.map((s) => s.clicks);
  const costSeries = series.map((s) => s.costMicros / 1_000_000);

  // Delta: last half vs. previous half of the window
  const half = Math.floor(series.length / 2);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const deltaFor = (arr: number[]): number | null => {
    if (arr.length < 2) return null;
    const prev = sum(arr.slice(0, half));
    const curr = sum(arr.slice(half));
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        label="Impressionen"
        value={formatNumber(totals.impressions)}
        delta={deltaFor(impressionsSeries)}
        series={impressionsSeries}
        loading={loading}
        accent="info"
      />
      <KpiTile
        label="Klicks"
        value={formatNumber(totals.clicks)}
        delta={deltaFor(clicksSeries)}
        series={clicksSeries}
        loading={loading}
        accent="info"
      />
      <KpiTile
        label="Spend"
        value={formatMoneyFromMicros(totals.costMicros)}
        delta={deltaFor(costSeries)}
        series={costSeries}
        loading={loading}
        accent="warning"
      />
      <KpiTile
        label="Chat-Starts"
        value={formatNumber(funnelChatStarts)}
        delta={null}
        series={[]}
        loading={loading}
        accent="success"
      />
    </div>
  );
}
