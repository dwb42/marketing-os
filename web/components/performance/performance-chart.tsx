"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { formatNumber, formatMoneyFromMicros } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import type { PerformanceRow } from "@/lib/types";

export function PerformanceChart({
  rows,
  prevRows,
  loading,
}: {
  rows: PerformanceRow[];
  prevRows?: PerformanceRow[];
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={24} />}
        title="Keine Performance-Daten"
        description="Sobald ein Sync-Pull Daten liefert, erscheinen sie hier."
      />
    );
  }

  const data = mergeByDayOffset(rows, prevRows ?? []);
  const compareOn = (prevRows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Impressionen · Klicks
          </div>
          {compareOn ? (
            <div className="text-[10px] text-muted-foreground">
              gestrichelt = Vorperiode
            </div>
          ) : null}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
            <YAxis yAxisId="imp" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
            <YAxis yAxisId="clk" orientation="right" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(v: unknown) => formatNumber(v as number)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="imp" type="monotone" dataKey="impressions" name="Impressionen" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line yAxisId="clk" type="monotone" dataKey="clicks" name="Klicks" stroke="hsl(142 65% 52%)" strokeWidth={2} dot={false} />
            {compareOn ? (
              <>
                <Line yAxisId="imp" type="monotone" dataKey="prevImpressions" name="Impressionen (prev)" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.5} />
                <Line yAxisId="clk" type="monotone" dataKey="prevClicks" name="Klicks (prev)" stroke="hsl(142 65% 52%)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.5} />
              </>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          Spend · Conversions
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(v: unknown, name: string) =>
                name.toLowerCase().includes("spend")
                  ? formatMoneyFromMicros((v as number) * 1_000_000)
                  : formatNumber(v as number, 1)
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend" name="Spend" fill="hsl(38 92% 58%)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="conversions" name="Conversions" fill="hsl(217 91% 60%)" radius={[2, 2, 0, 0]} />
            {compareOn ? (
              <>
                <Bar dataKey="prevSpend" name="Spend (prev)" fill="hsl(38 92% 58%)" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
                <Bar dataKey="prevConversions" name="Conversions (prev)" fill="hsl(217 91% 60%)" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
              </>
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface DayRow {
  date: string;
  label: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  prevImpressions?: number;
  prevClicks?: number;
  prevSpend?: number;
  prevConversions?: number;
}

/**
 * Align current + previous windows by day offset (day 0 = first day of each
 * window). Returns rows with both-period fields so Recharts can overlay.
 */
function mergeByDayOffset(rows: PerformanceRow[], prevRows: PerformanceRow[]): DayRow[] {
  const agg = (xs: PerformanceRow[]) => {
    const m = new Map<string, { date: string; impressions: number; clicks: number; costMicros: number; conversions: number }>();
    for (const r of xs) {
      const k = r.date.slice(0, 10);
      const b = m.get(k) ?? { date: k, impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
      b.impressions += r.impressions;
      b.clicks += r.clicks;
      b.costMicros += Number(r.costMicros);
      b.conversions += Number(r.conversions);
      m.set(k, b);
    }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const curr = agg(rows);
  const prev = agg(prevRows);

  // Zip by index (day-offset alignment).
  const out: DayRow[] = [];
  for (let i = 0; i < curr.length; i++) {
    const c = curr[i];
    const p = prev[i];
    out.push({
      date: c.date,
      label: c.date.slice(5),
      impressions: c.impressions,
      clicks: c.clicks,
      spend: c.costMicros / 1_000_000,
      conversions: c.conversions,
      ...(p
        ? {
            prevImpressions: p.impressions,
            prevClicks: p.clicks,
            prevSpend: p.costMicros / 1_000_000,
            prevConversions: p.conversions,
          }
        : {}),
    });
  }
  return out;
}
