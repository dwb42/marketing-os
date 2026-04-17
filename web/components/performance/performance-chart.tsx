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
  loading,
}: {
  rows: PerformanceRow[];
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

  // Aggregate by day (across all ccps)
  const byDay = new Map<string, { date: string; impressions: number; clicks: number; costMicros: number; conversions: number }>();
  for (const r of rows) {
    const k = r.date.slice(0, 10);
    const b = byDay.get(k) ?? { date: k, impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
    b.impressions += r.impressions;
    b.clicks += r.clicks;
    b.costMicros += Number(r.costMicros);
    b.conversions += Number(r.conversions);
    byDay.set(k, b);
  }
  const data = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      spend: d.costMicros / 1_000_000,
      label: d.date.slice(5),
    }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          Impressionen · Klicks
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
                name === "Spend" ? formatMoneyFromMicros((v as number) * 1_000_000) : formatNumber(v as number, 1)
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend" name="Spend" fill="hsl(38 92% 58%)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="conversions" name="Conversions" fill="hsl(217 91% 60%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
