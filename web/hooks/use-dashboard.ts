"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { daysAgo, todayEnd, isoDate } from "@/lib/format";
import type { Campaign, PerformanceRow, ChannelCampaign } from "@/lib/types";

/**
 * Dashboard data aggregator.
 * Fetches campaigns → details → performance rows for every synced
 * channel-campaign in the window, then rolls up totals + per-day series.
 *
 * When `compare` is true, also fetches the immediately-preceding window of
 * the same length ("Vorperiode") and exposes it as `prevTotals` / `prevSeries`.
 */
export function useDashboardData(
  workspaceId: string,
  productId: string | null,
  days = 14,
  compare = false,
) {
  const from = isoDate(daysAgo(days));
  const to = isoDate(todayEnd());
  const prevFrom = isoDate(daysAgo(days * 2));
  const prevTo = isoDate(daysAgo(days + 1));

  const campaignsQ = useQuery<Campaign[]>({
    queryKey: ["campaigns", workspaceId],
    queryFn: () => api.campaigns.list({ workspaceId }),
    enabled: !!workspaceId,
  });

  const campaigns = campaignsQ.data ?? [];
  // Only synced/paused campaigns have channelCampaigns with actual data.
  const materializedCampaigns = campaigns.filter(
    (c) => c.status === "SYNCED" || c.status === "PAUSED",
  );

  const detailQueries = useQueries({
    queries: materializedCampaigns.map((c) => ({
      queryKey: ["campaign", c.id, workspaceId],
      queryFn: () => api.campaigns.get(c.id, workspaceId),
      enabled: !!workspaceId,
      staleTime: 30_000,
    })),
  });

  const channelCampaigns: Array<ChannelCampaign & { campaignName: string }> = [];
  for (let i = 0; i < detailQueries.length; i++) {
    const d = detailQueries[i].data;
    if (d?.channelCampaigns) {
      for (const cc of d.channelCampaigns) {
        channelCampaigns.push({ ...cc, campaignName: d.name });
      }
    }
  }

  const perfQueries = useQueries({
    queries: channelCampaigns.map((cc) => ({
      queryKey: ["performance", cc.id, from, to],
      queryFn: () =>
        api.performance.query({ channelCampaignId: cc.id, from, to }),
      enabled: !!cc.id,
      staleTime: 30_000,
    })),
  });

  const prevPerfQueries = useQueries({
    queries: compare
      ? channelCampaigns.map((cc) => ({
          queryKey: ["performance", cc.id, prevFrom, prevTo],
          queryFn: () =>
            api.performance.query({
              channelCampaignId: cc.id,
              from: prevFrom,
              to: prevTo,
            }),
          enabled: !!cc.id,
          staleTime: 30_000,
        }))
      : [],
  });

  const allRows: PerformanceRow[] = [];
  for (const q of perfQueries) if (q.data) allRows.push(...q.data);

  const prevRows: PerformanceRow[] = [];
  for (const q of prevPerfQueries) if (q.data) prevRows.push(...q.data);

  // Totals over window
  const totals = {
    impressions: 0,
    clicks: 0,
    costMicros: 0,
    conversions: 0,
  };
  for (const r of allRows) {
    totals.impressions += r.impressions;
    totals.clicks += r.clicks;
    totals.costMicros += Number(r.costMicros);
    totals.conversions += Number(r.conversions);
  }

  // Per-day time series (aggregated across all ccps)
  type DayBucket = { date: string; impressions: number; clicks: number; costMicros: number };
  const daily = new Map<string, DayBucket>();
  for (const r of allRows) {
    const key = r.date.slice(0, 10);
    const b = daily.get(key) ?? {
      date: key,
      impressions: 0,
      clicks: 0,
      costMicros: 0,
    };
    b.impressions += r.impressions;
    b.clicks += r.clicks;
    b.costMicros += Number(r.costMicros);
    daily.set(key, b);
  }
  const series = Array.from(daily.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // Previous-period totals + normalized series (re-indexed so day 0 aligns).
  const prevTotals = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
  const prevDaily = new Map<string, DayBucket>();
  for (const r of prevRows) {
    prevTotals.impressions += r.impressions;
    prevTotals.clicks += r.clicks;
    prevTotals.costMicros += Number(r.costMicros);
    prevTotals.conversions += Number(r.conversions);
    const key = r.date.slice(0, 10);
    const b = prevDaily.get(key) ?? {
      date: key,
      impressions: 0,
      clicks: 0,
      costMicros: 0,
    };
    b.impressions += r.impressions;
    b.clicks += r.clicks;
    b.costMicros += Number(r.costMicros);
    prevDaily.set(key, b);
  }
  const prevSeries = Array.from(prevDaily.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // Per-channel-campaign rollup (used for "Active Campaigns" table)
  const ccpTotals = new Map<
    string,
    {
      channelCampaignId: string;
      campaignName: string;
      channel: string;
      externalId: string | null;
      status: string;
      impressions: number;
      clicks: number;
      costMicros: number;
      sparkline: number[];
    }
  >();
  for (const cc of channelCampaigns) {
    ccpTotals.set(cc.id, {
      channelCampaignId: cc.id,
      campaignName: cc.campaignName,
      channel: cc.channel,
      externalId: cc.externalId,
      status: cc.status,
      impressions: 0,
      clicks: 0,
      costMicros: 0,
      sparkline: [],
    });
  }
  for (const r of allRows) {
    if (!r.channelCampaignId) continue;
    const t = ccpTotals.get(r.channelCampaignId);
    if (!t) continue;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
    t.costMicros += Number(r.costMicros);
    t.sparkline.push(r.clicks);
  }

  const isLoading =
    campaignsQ.isLoading ||
    detailQueries.some((q) => q.isLoading) ||
    perfQueries.some((q) => q.isLoading);
  const isError =
    campaignsQ.isError ||
    detailQueries.some((q) => q.isError) ||
    perfQueries.some((q) => q.isError);
  const error =
    campaignsQ.error ??
    detailQueries.find((q) => q.error)?.error ??
    perfQueries.find((q) => q.error)?.error;

  return {
    from,
    to,
    prevFrom,
    prevTo,
    campaigns,
    materializedCampaigns,
    channelCampaigns,
    totals,
    series,
    prevTotals,
    prevSeries,
    ccpTotals: Array.from(ccpTotals.values()),
    isLoading,
    isError,
    error,
  };
}


export function useOutcomeFunnel(productId: string, days = 14) {
  const from = isoDate(daysAgo(days));
  const to = isoDate(todayEnd());
  return useQuery({
    queryKey: ["funnel", productId, from, to],
    queryFn: () => api.outcomes.funnel({ productId, from, to }),
    enabled: !!productId,
  });
}

export function useRecentChangelog(workspaceId: string, days = 14) {
  const from = isoDate(daysAgo(days));
  const to = isoDate(todayEnd());
  return useQuery({
    queryKey: ["changelog", workspaceId, from, to],
    queryFn: () => api.changelog.query({ workspaceId, from, to }),
    enabled: !!workspaceId,
  });
}

export function useOpenFindings(workspaceId: string) {
  return useQuery({
    queryKey: ["findings", workspaceId, "OPEN"],
    queryFn: () => api.findings.list({ workspaceId, status: "OPEN" }),
    enabled: !!workspaceId,
  });
}

export function useFailedSyncs(workspaceId: string) {
  return useQuery({
    queryKey: ["sync-runs", workspaceId, "FAILED"],
    queryFn: () => api.syncRuns.list({ workspaceId, status: "FAILED" }),
    enabled: !!workspaceId,
  });
}

export function usePendingApprovals(workspaceId: string) {
  return useQuery({
    queryKey: ["approvals", workspaceId, "REQUESTED"],
    queryFn: () => api.approvals.list({ workspaceId, decision: "REQUESTED" }),
    enabled: !!workspaceId,
  });
}
