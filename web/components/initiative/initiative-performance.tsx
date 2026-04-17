"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { EmptyState } from "@/components/common/empty-state";
import { formatNumber, formatMoneyFromMicros, formatPercent } from "@/lib/format";
import type { PerformanceRow } from "@/lib/types";

/**
 * Compact performance summary for the initiative detail header:
 * 4 KPI tiles with sparklines, rolled up across all associated campaigns.
 */
export function InitiativePerformance({ rows }: { rows: PerformanceRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Noch keine Performance-Daten"
        description="Sobald verknüpfte Kampagnen gesynct sind und der erste Pull läuft, erscheinen hier Impressionen/Klicks/Spend."
      />
    );
  }

  type DayBucket = {
    date: string;
    impressions: number;
    clicks: number;
    costMicros: number;
    conversions: number;
  };
  const byDay = new Map<string, DayBucket>();
  const totals = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };

  for (const r of rows) {
    const key = r.date.slice(0, 10);
    const b =
      byDay.get(key) ??
      ({ date: key, impressions: 0, clicks: 0, costMicros: 0, conversions: 0 } as DayBucket);
    b.impressions += r.impressions;
    b.clicks += r.clicks;
    b.costMicros += Number(r.costMicros);
    b.conversions += Number(r.conversions);
    byDay.set(key, b);
    totals.impressions += r.impressions;
    totals.clicks += r.clicks;
    totals.costMicros += Number(r.costMicros);
    totals.conversions += Number(r.conversions);
  }
  const series = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Tile label="Impressionen" value={formatNumber(totals.impressions)} series={series.map((s) => s.impressions)} tone="text-blue-500" />
      <Tile label="Klicks · CTR" value={`${formatNumber(totals.clicks)} · ${formatPercent(ctr, 1)}`} series={series.map((s) => s.clicks)} tone="text-emerald-500" />
      <Tile label="Spend" value={formatMoneyFromMicros(totals.costMicros)} series={series.map((s) => s.costMicros / 1_000_000)} tone="text-amber-500" />
      <Tile label="Conversions" value={formatNumber(totals.conversions, 0)} series={series.map((s) => s.conversions)} tone="text-primary" />
    </div>
  );
}

function Tile({
  label,
  value,
  series,
  tone,
}: {
  label: string;
  value: string;
  series: number[];
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
        <div className={`h-7 mt-2 -mx-1 ${tone}`}>
          <Sparkline values={series} />
        </div>
      </CardContent>
    </Card>
  );
}
