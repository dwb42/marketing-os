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

export default function PerformancePage() {
  const { workspaceId, workspace } = useSelectedWorkspace();
  const [days, setDays] = useState(30);

  const dash = useDashboardData(workspaceId, null, days);

  if (!workspaceId) {
    return <EmptyState title="Kein Workspace ausgewählt" />;
  }

  // Combine all perf rows for global chart.
  const allRows = dash.series.map((s) => ({
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
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description={workspace ? `${workspace.name} · aggregiert über alle Channel-Kampagnen` : ""}
        actions={
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
        }
      />

      {dash.isError ? <ErrorState error={dash.error} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiMini label="Impressionen" value={formatNumber(dash.totals.impressions)} loading={dash.isLoading} />
        <KpiMini label="Klicks" value={formatNumber(dash.totals.clicks)} loading={dash.isLoading} />
        <KpiMini label="Spend" value={formatMoneyFromMicros(dash.totals.costMicros)} loading={dash.isLoading} />
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
            <PerformanceChart rows={allRows} />
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

function KpiMini({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-1.5" />
      ) : (
        <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      )}
    </Card>
  );
}
