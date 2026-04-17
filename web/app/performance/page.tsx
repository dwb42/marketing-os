"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PerformanceChart } from "@/components/performance/performance-chart";
import { IdChip } from "@/components/common/id-chip";
import { StatusBadge } from "@/components/common/status-badge";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { useDashboardData } from "@/hooks/use-dashboard";
import { formatNumber, formatMoneyFromMicros, formatPercent } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { ExportCsvButton } from "@/components/common/export-button";

export default function PerformancePage() {
  const { workspaceId, workspace } = useSelectedWorkspace();
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);

  const dash = useDashboardData(workspaceId, null, days, compare);

  if (!workspaceId) {
    return <EmptyState title="Kein Workspace ausgewählt" />;
  }

  // Synthesize PerformanceRow-shape from pre-aggregated daily series for chart.
  const toRow = (s: { date: string; impressions: number; clicks: number; costMicros: number }) => ({
    id: s.date,
    channelCampaignId: "agg",
    date: s.date,
    impressions: s.impressions,
    clicks: s.clicks,
    costMicros: String(s.costMicros),
    conversions: 0,
    conversionValue: 0,
    raw: {},
    pulledAt: s.date,
    syncRunId: null,
  });
  const allRows = dash.series.map(toRow);
  const prevAllRows = compare ? dash.prevSeries.map(toRow) : undefined;

  // Delta helpers
  const delta = (curr: number, prev: number): { pct: number | null; dir: 1 | -1 | 0 } => {
    if (!compare || prev === 0) return { pct: null, dir: curr > 0 ? 1 : 0 };
    const pct = ((curr - prev) / prev) * 100;
    return { pct, dir: pct > 0 ? 1 : pct < 0 ? -1 : 0 };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description={workspace ? `${workspace.name} · aggregiert über alle Channel-Kampagnen` : ""}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-8 min-w-[120px] text-xs"
            >
              <option value="7">7 Tage</option>
              <option value="14">14 Tage</option>
              <option value="30">30 Tage</option>
              <option value="60">60 Tage</option>
              <option value="90">90 Tage</option>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-2 h-8 rounded-md border border-border hover:bg-muted">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="accent-primary"
              />
              vs. Vorperiode
            </label>
            <ExportCsvButton
              rows={dash.ccpTotals}
              filenamePrefix="performance-per-campaign"
              columns={[
                { header: "Campaign", value: (r) => r.campaignName },
                { header: "ChannelCampaignId", value: (r) => r.channelCampaignId },
                { header: "Channel", value: (r) => r.channel },
                { header: "Status", value: (r) => r.status },
                { header: "Impressions", value: (r) => r.impressions },
                { header: "Clicks", value: (r) => r.clicks },
                { header: "CTR", value: (r) => (r.impressions > 0 ? r.clicks / r.impressions : 0) },
                { header: "SpendEUR", value: (r) => (r.costMicros / 1_000_000).toFixed(2) },
              ]}
            />
          </div>
        }
      />

      {dash.isError ? <ErrorState error={dash.error} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiMini
          label="Impressionen"
          value={formatNumber(dash.totals.impressions)}
          prev={compare ? formatNumber(dash.prevTotals.impressions) : undefined}
          delta={delta(dash.totals.impressions, dash.prevTotals.impressions)}
          loading={dash.isLoading}
        />
        <KpiMini
          label="Klicks"
          value={formatNumber(dash.totals.clicks)}
          prev={compare ? formatNumber(dash.prevTotals.clicks) : undefined}
          delta={delta(dash.totals.clicks, dash.prevTotals.clicks)}
          loading={dash.isLoading}
        />
        <KpiMini
          label="Spend"
          value={formatMoneyFromMicros(dash.totals.costMicros)}
          prev={compare ? formatMoneyFromMicros(dash.prevTotals.costMicros) : undefined}
          delta={delta(dash.totals.costMicros, dash.prevTotals.costMicros)}
          loading={dash.isLoading}
        />
        <KpiMini
          label="CTR · CPC"
          value={
            dash.totals.impressions > 0
              ? `${formatPercent(dash.totals.clicks / dash.totals.impressions, 1)} · ${formatMoneyFromMicros(dash.totals.clicks > 0 ? dash.totals.costMicros / dash.totals.clicks : 0)}`
              : "—"
          }
          loading={dash.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verlauf</CardTitle>
          <CardDescription>Letzte {days} Tage · aggregiert</CardDescription>
        </CardHeader>
        <CardContent>
          {dash.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : allRows.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={24} />}
              title="Noch keine Performance-Daten"
              description="Sobald ein Sync-Pull läuft, werden hier Impressionen/Klicks/Spend angezeigt."
            />
          ) : (
            <PerformanceChart rows={allRows} prevRows={prevAllRows} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pro Channel-Kampagne</CardTitle>
          <CardDescription>Aktive Channel-Kampagnen im Zeitraum</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {dash.isLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : dash.ccpTotals.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Keine Channel-Kampagnen" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left font-medium px-5 py-2">Kampagne</th>
                  <th className="text-left font-medium px-2 py-2">Channel</th>
                  <th className="text-left font-medium px-2 py-2">Status</th>
                  <th className="text-right font-medium px-2 py-2">Impr.</th>
                  <th className="text-right font-medium px-2 py-2">Klicks</th>
                  <th className="text-right font-medium px-2 py-2">CTR</th>
                  <th className="text-right font-medium px-5 py-2">Spend</th>
                </tr>
              </thead>
              <tbody>
                {dash.ccpTotals.map((r) => {
                  const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
                  return (
                    <tr key={r.channelCampaignId} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-2.5">
                        <Link href="/campaigns" className="font-medium hover:underline">
                          {r.campaignName}
                        </Link>
                        <div className="mt-0.5">
                          <IdChip id={r.channelCampaignId} />
                        </div>
                      </td>
                      <td className="px-2 py-2.5">{r.channel}</td>
                      <td className="px-2 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(r.impressions)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{formatPercent(ctr, 1)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatMoneyFromMicros(r.costMicros)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiMini({
  label,
  value,
  prev,
  delta,
  loading,
}: {
  label: string;
  value: string;
  prev?: string;
  delta?: { pct: number | null; dir: 1 | -1 | 0 };
  loading?: boolean;
}) {
  const deltaClass = !delta
    ? "text-muted-foreground"
    : delta.dir > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta.dir < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {delta?.pct !== null && delta?.pct !== undefined ? (
          <div className={`text-[11px] font-medium tabular-nums ${deltaClass}`}>
            {delta.pct > 0 ? "+" : ""}
            {delta.pct.toFixed(0)}%
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-1.5" />
      ) : (
        <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      )}
      {prev ? (
        <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
          Vorher: {prev}
        </div>
      ) : null}
    </Card>
  );
}
