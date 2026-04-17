"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/common/error-state";
import { IdChip } from "@/components/common/id-chip";
import { RelativeTime } from "@/components/common/relative-time";
import { PerformanceChart } from "@/components/performance/performance-chart";
import { EmptyState } from "@/components/common/empty-state";
import { iconForEvent } from "@/components/activity/event-icon";
import { formatDate, formatDateTime, daysAgo, todayEnd, isoDate, formatNumber, formatMoneyFromMicros, formatPercent } from "@/lib/format";
import { api } from "@/lib/api";
import type { AssetVersion, Campaign } from "@/lib/types";
import { ArrowLeft, ExternalLink } from "lucide-react";

export function CampaignDetail({
  campaignId,
  workspaceId,
}: {
  campaignId: string;
  workspaceId: string;
}) {
  const campaignQ = useQuery<Campaign>({
    queryKey: ["campaign", campaignId, workspaceId],
    queryFn: () => api.campaigns.get(campaignId, workspaceId),
    enabled: !!workspaceId,
  });

  const campaign = campaignQ.data;

  const from = isoDate(daysAgo(30));
  const to = isoDate(todayEnd());

  const ccpIds = campaign?.channelCampaigns?.map((c) => c.id) ?? [];
  const perfQueries = useQueries({
    queries: ccpIds.map((id) => ({
      queryKey: ["performance", id, from, to],
      queryFn: () => api.performance.query({ channelCampaignId: id, from, to }),
    })),
  });

  const syncsQ = useQuery({
    queryKey: ["sync-runs-for-campaign", campaignId, workspaceId],
    queryFn: () => api.syncRuns.list({ workspaceId }),
    enabled: !!workspaceId,
  });

  const changelogQ = useQuery({
    queryKey: ["changelog-for-campaign", campaignId, workspaceId],
    queryFn: () =>
      api.changelog.query({
        workspaceId,
        subjectType: "CAMPAIGN",
        subjectId: campaignId,
      }),
    enabled: !!workspaceId,
  });

  const assetIds = campaign?.campaignAssets?.map((ca) => ca.assetId) ?? [];
  const assetVersionsQueries = useQueries({
    queries: assetIds.map((assetId) => ({
      queryKey: ["asset-versions", assetId, workspaceId],
      queryFn: () => api.assets.versions(assetId, workspaceId),
      enabled: !!workspaceId,
    })),
  });

  if (campaignQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (campaignQ.isError || !campaign) {
    return <ErrorState error={campaignQ.error} onRetry={() => campaignQ.refetch()} />;
  }

  const allPerfRows = perfQueries.flatMap((q) => q.data ?? []);
  const totals = allPerfRows.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.costMicros += Number(r.costMicros);
      acc.conversions += Number(r.conversions);
      return acc;
    },
    { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 },
  );
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const cpc = totals.clicks > 0 ? totals.costMicros / totals.clicks : 0;

  const campaignSyncs = (syncsQ.data ?? []).filter(
    (s) => s.targetId === campaignId || s.targetId === ccpIds.find((id) => id === s.targetId),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/campaigns"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft size={12} /> Alle Kampagnen
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {campaign.name}
              </h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {campaign.objective}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
              <IdChip id={campaign.id} />
              {campaign.initiativeId ? (
                <span className="text-muted-foreground">
                  Initiative <IdChip id={campaign.initiativeId} />
                </span>
              ) : null}
              {campaign.audienceSegmentId ? (
                <span className="text-muted-foreground">
                  Audience <IdChip id={campaign.audienceSegmentId} />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Quick-Facts KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Impressionen</div>
          <div className="text-xl font-semibold tabular-nums mt-1">{formatNumber(totals.impressions)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Klicks · CTR</div>
          <div className="text-xl font-semibold tabular-nums mt-1">
            {formatNumber(totals.clicks)} <span className="text-sm text-muted-foreground font-normal">· {formatPercent(ctr, 1)}</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Spend · CPC</div>
          <div className="text-xl font-semibold tabular-nums mt-1">
            {formatMoneyFromMicros(totals.costMicros)} <span className="text-sm text-muted-foreground font-normal">· {formatMoneyFromMicros(cpc)}</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Conversions</div>
          <div className="text-xl font-semibold tabular-nums mt-1">
            {formatNumber(totals.conversions, 0)}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="syncs">Sync-History</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Channel-Kampagnen</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(campaign.channelCampaigns ?? []).length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="Noch nicht gesynct"
                      description="Diese Campaign ist noch auf keinem externen Channel angelegt."
                    />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                        <th className="text-left font-medium px-5 py-2">Channel</th>
                        <th className="text-left font-medium px-2 py-2">External ID</th>
                        <th className="text-left font-medium px-2 py-2">Status</th>
                        <th className="text-right font-medium px-5 py-2">Letzter Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(campaign.channelCampaigns ?? []).map((cc) => (
                        <tr key={cc.id} className="border-b border-border last:border-0">
                          <td className="px-5 py-2.5 font-medium">{cc.channel}</td>
                          <td className="px-2 py-2.5 font-mono text-xs">{cc.externalId ?? "—"}</td>
                          <td className="px-2 py-2.5"><StatusBadge status={cc.status} /></td>
                          <td className="px-5 py-2.5 text-right">
                            <RelativeTime date={cc.lastSyncedAt} className="text-xs text-muted-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick-Facts</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <Fact label="Product" value={<IdChip id={campaign.productId} />} />
                <Fact label="Start" value={formatDate(campaign.startsAt)} />
                <Fact label="Ende" value={formatDate(campaign.endsAt)} />
                <Fact label="Erstellt" value={formatDateTime(campaign.createdAt)} />
                <Fact label="Aktualisiert" value={formatDateTime(campaign.updatedAt)} />
                {campaign.createdByActorId ? (
                  <Fact label="Creator" value={<IdChip id={campaign.createdByActorId} />} />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance · letzte 30 Tage</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart rows={allPerfRows} loading={perfQueries.some((q) => q.isLoading)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <div className="space-y-3">
            {(campaign.campaignAssets ?? []).length === 0 ? (
              <EmptyState
                title="Keine Assets verknüpft"
                description="Diese Campaign hat noch keine Assets."
              />
            ) : (
              (campaign.campaignAssets ?? []).map((ca, i) => {
                const versions: AssetVersion[] = assetVersionsQueries[i]?.data ?? [];
                const latest = versions[versions.length - 1];
                return (
                  <Card key={ca.assetId}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {ca.role ?? "asset"}
                          </div>
                          <IdChip id={ca.assetId} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span>{versions.length} Versionen</span>
                          {latest ? (
                            <>
                              <span className="opacity-40">·</span>
                              <span>neueste: v{latest.versionNum}</span>
                              <StatusBadge status={latest.status} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="syncs">
          <Card>
            <CardContent className="p-0">
              {syncsQ.isLoading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : campaignSyncs.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Keine Sync-Runs" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="text-left font-medium px-5 py-2">Type</th>
                      <th className="text-left font-medium px-2 py-2">Channel</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                      <th className="text-left font-medium px-2 py-2">Error</th>
                      <th className="text-right font-medium px-5 py-2">Zeit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignSyncs.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-2.5 font-mono text-xs">{s.type}</td>
                        <td className="px-2 py-2.5">{s.channel}</td>
                        <td className="px-2 py-2.5"><StatusBadge status={s.status} /></td>
                        <td className="px-2 py-2.5 text-xs text-red-600 dark:text-red-400 line-clamp-1 max-w-[240px]">
                          {s.errorMessage ?? ""}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <RelativeTime date={s.createdAt} className="text-xs text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog">
          <Card>
            <CardContent className="p-0">
              {changelogQ.isLoading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (changelogQ.data ?? []).length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Keine Events" />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {(changelogQ.data ?? [])
                    .slice()
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((e) => {
                      const { icon: Icon, tone } = iconForEvent(e.kind);
                      return (
                        <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                          <div className={`mt-0.5 size-6 shrink-0 grid place-items-center rounded-md ${tone}`}>
                            <Icon size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">{e.summary}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                              <RelativeTime date={e.at} />
                              <span className="opacity-40">·</span>
                              <span className="font-mono">{e.kind}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
