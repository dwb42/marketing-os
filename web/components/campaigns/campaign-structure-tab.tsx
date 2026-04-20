"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Link as LinkIcon, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdChip } from "@/components/common/id-chip";
import { RelativeTime } from "@/components/common/relative-time";
import { api } from "@/lib/api";
import {
  daysAgo,
  formatMoneyFromMicros,
  formatNumber,
  formatPercent,
  isoDate,
  todayEnd,
} from "@/lib/format";
import type {
  CampaignStructureChannel,
  ChannelStructureAdGroup,
  ChannelStructureAd,
  ChannelStructureKeyword,
  PerformanceRow,
} from "@/lib/types";

type OsAttribution = {
  utmCampaignValues: string[];
  totalMatched: number;
  byAdGroupExternalId: Record<string, { total: number; byType: Record<string, number> }>;
  byKeywordText: Record<string, { total: number; byType: Record<string, number> }>;
  unattributedToAdGroup: number;
};

export function CampaignStructureTab({
  campaignId,
  workspaceId,
}: {
  campaignId: string;
  workspaceId: string;
}) {
  const qc = useQueryClient();
  const structureQ = useQuery({
    queryKey: ["campaign-structure", campaignId, workspaceId],
    queryFn: () => api.campaigns.structure(campaignId, workspaceId),
    enabled: !!workspaceId,
  });

  const osAttrQ = useQuery({
    queryKey: ["outcome-attribution", campaignId, workspaceId],
    queryFn: () => api.campaigns.outcomeAttribution(campaignId, { workspaceId }),
    enabled: !!workspaceId,
  });

  const syncMut = useMutation({
    mutationFn: () => api.campaigns.syncStructure(campaignId, { workspaceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-structure", campaignId, workspaceId] });
      qc.invalidateQueries({ queryKey: ["changelog-tree", campaignId, workspaceId] });
      qc.invalidateQueries({ queryKey: ["outcome-attribution", campaignId, workspaceId] });
    },
  });

  const trackingMut = useMutation({
    mutationFn: (ccId: string) =>
      api.channelCampaigns.setTrackingSuffix(ccId, { workspaceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changelog-tree", campaignId, workspaceId] });
    },
  });

  if (structureQ.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (structureQ.isError) {
    return <ErrorState error={structureQ.error} onRetry={() => structureQ.refetch()} />;
  }
  const channels = structureQ.data ?? [];
  if (channels.length === 0) {
    return (
      <EmptyState
        title="Noch keine Channel-Struktur gesynct"
        description={`Klick auf "Struktur pullen", um Ad Groups, Ads, Keywords und Negatives von Google Ads zu laden.`}
        action={
          <Button size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw size={13} className={syncMut.isPending ? "animate-spin" : ""} />
            Struktur pullen
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {channels.length} Channel-Campaign{channels.length === 1 ? "" : "s"}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
        >
          <RefreshCw size={13} className={syncMut.isPending ? "animate-spin" : ""} />
          {syncMut.isPending ? "Pulle…" : "Jetzt syncen"}
        </Button>
      </div>
      {syncMut.isError ? (
        <ErrorState
          error={syncMut.error}
          onRetry={() => syncMut.mutate()}
        />
      ) : null}
      {syncMut.isSuccess ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          Sync erfolgreich —{" "}
          {syncMut.data.results.map((r, i) => (
            <span key={r.channelCampaignId}>
              {i > 0 ? " · " : ""}
              {r.structure.adGroupsTotal} AGs, {r.structure.adsTotal} Ads,{" "}
              {r.structure.keywordsTotal} Keywords, {r.structure.negativesTotal} Negatives,{" "}
              {r.structure.eventCount} Changes
            </span>
          ))}
        </div>
      ) : null}

      <OsAttributionBanner
        attribution={osAttrQ.data}
        channels={channels}
        onSetSuffix={(ccId) => trackingMut.mutate(ccId)}
        suffixPending={trackingMut.isPending}
        suffixError={trackingMut.isError ? trackingMut.error : null}
        suffixApplied={trackingMut.isSuccess ? trackingMut.data?.suffix : null}
      />

      {channels.map((ch) => (
        <ChannelBlock
          key={ch.id}
          channel={ch}
          workspaceId={workspaceId}
          osAttribution={osAttrQ.data ?? null}
        />
      ))}
    </div>
  );
}

function OsAttributionBanner({
  attribution,
  channels,
  onSetSuffix,
  suffixPending,
  suffixError,
  suffixApplied,
}: {
  attribution: OsAttribution | undefined;
  channels: CampaignStructureChannel[];
  onSetSuffix: (ccId: string) => void;
  suffixPending: boolean;
  suffixError: unknown;
  suffixApplied: string | null | undefined;
}) {
  if (!attribution) return null;

  const noUtm = attribution.utmCampaignValues.length === 0;
  const hasAdGroupMatches = Object.keys(attribution.byAdGroupExternalId).length > 0;
  const ccId = channels.find((c) => c.channel === "GOOGLE_ADS")?.id ?? null;

  if (noUtm) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.03] p-3 text-xs">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-medium">OS-Conversion-Loop offen: kein utm_campaign in den Assets.</div>
          <div className="text-muted-foreground max-w-2xl">
            Setze in einer Asset-Version ein <code className="font-mono">targetUrl</code> mit{" "}
            <code className="font-mono">?utm_campaign=…</code>, damit Outcomes der Kampagne
            zugeordnet werden können. Ad-Group-/Keyword-Attribution kommt anschließend über{" "}
            <code className="font-mono">utm_content</code> und <code className="font-mono">utm_term</code>.
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdGroupMatches) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.03] p-3 text-xs">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="font-medium">
            OS-Conv pro Ad-Group noch leer — Final-URL-Suffix in Google Ads fehlt.
          </div>
          <div className="text-muted-foreground max-w-2xl">
            Landing-Page kriegt <code className="font-mono">utm_campaign</code> (
            <code className="font-mono">{attribution.utmCampaignValues.join(", ")}</code>), aber
            nicht <code className="font-mono">utm_content={"{adgroupid}"}</code>. Klick unten, dann
            setzt das OS auf der Google-Ads-Campaign einen Final-URL-Suffix, der bei jedem Klick
            automatisch <code className="font-mono">utm_content</code> und{" "}
            <code className="font-mono">utm_term</code> mitschickt.
          </div>
          {suffixApplied ? (
            <div className="rounded-md border border-border bg-background p-2 font-mono text-[10px] break-all">
              {suffixApplied}
            </div>
          ) : null}
          {suffixError ? (
            <div className="text-red-600 dark:text-red-400">
              Setzen fehlgeschlagen: {(suffixError as Error).message}
            </div>
          ) : null}
          {ccId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetSuffix(ccId)}
              disabled={suffixPending}
            >
              <LinkIcon size={13} />
              {suffixPending ? "Setze…" : "Tracking-Suffix jetzt setzen"}
            </Button>
          ) : null}
          <div className="text-[11px] text-muted-foreground">
            Die Landing-Page muss <code className="font-mono">utm_content</code> und{" "}
            <code className="font-mono">utm_term</code> aus der URL in die Outcome-Attribution
            übernehmen.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs flex items-center gap-3 flex-wrap">
      <span className="font-medium">OS-Conv attribuiert:</span>
      <span className="tabular-nums">{attribution.totalMatched} Events</span>
      <span className="opacity-40">·</span>
      <span className="tabular-nums">
        {Object.keys(attribution.byAdGroupExternalId).length} Ad-Group(s)
      </span>
      <span className="opacity-40">·</span>
      <span className="tabular-nums">
        {Object.keys(attribution.byKeywordText).length} Keyword(s)
      </span>
      {attribution.unattributedToAdGroup > 0 ? (
        <>
          <span className="opacity-40">·</span>
          <span className="text-muted-foreground">
            {attribution.unattributedToAdGroup} ohne utm_content
          </span>
        </>
      ) : null}
    </div>
  );
}

function ChannelBlock({
  channel,
  workspaceId,
  osAttribution,
}: {
  channel: CampaignStructureChannel;
  workspaceId: string;
  osAttribution: OsAttribution | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">{channel.channel}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          ext {channel.externalId ?? "—"}
        </span>
        <StatusBadge status={channel.status} />
        {channel.lastSyncedAt ? (
          <span className="text-[11px] text-muted-foreground">
            zuletzt gesynct <RelativeTime date={channel.lastSyncedAt} />
          </span>
        ) : null}
      </div>

      {channel.adGroups.length === 0 ? (
        <EmptyState
          title="Keine Ad Groups"
          description="Die Kampagne hat noch keine gesynceten Ad Groups."
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[11px] text-muted-foreground uppercase tracking-wide">
                <th className="w-6"></th>
                <th className="text-left font-medium px-3 py-2">Ad Group</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">CPC-Gebot</th>
                <th className="text-right font-medium px-2 py-2">Impr</th>
                <th className="text-right font-medium px-2 py-2">Klicks · CTR</th>
                <th className="text-right font-medium px-2 py-2">Spend · CPC</th>
                <th className="text-right font-medium px-2 py-2" title="Google-seitig gemessene Conversions (Google Ads Conversion-Tags)">
                  Google-Conv
                </th>
                <th className="text-right font-medium px-3 py-2" title="Outcome-Events aus dem Marketing-OS, attribuiert via utm_content">
                  OS-Conv
                </th>
              </tr>
            </thead>
            <tbody>
              {channel.adGroups.map((ag) => (
                <AdGroupRow
                  key={ag.id}
                  adGroup={ag}
                  workspaceId={workspaceId}
                  osAttribution={osAttribution}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {channel.negatives.length > 0 ? (
        <div className="rounded-md border border-border">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold">Campaign-Level Negatives</span>{" "}
            <span className="text-[11px] text-muted-foreground">
              ({channel.negatives.length})
            </span>
          </div>
          <ul className="divide-y divide-border">
            {channel.negatives.map((n) => (
              <li
                key={n.id}
                className="px-3 py-1.5 flex items-center gap-3 text-xs"
              >
                <span className="font-medium">{n.text}</span>
                <Badge variant="outline">{n.matchType}</Badge>
                <StatusBadge status={n.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AdGroupRow({
  adGroup,
  workspaceId,
  osAttribution,
}: {
  adGroup: ChannelStructureAdGroup;
  workspaceId: string;
  osAttribution: OsAttribution | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const from = isoDate(daysAgo(30));
  const to = isoDate(todayEnd());

  const perfQ = useQuery({
    queryKey: ["ag-perf", adGroup.id, from, to],
    queryFn: () =>
      api.channelAdGroups.performance(adGroup.id, { workspaceId, from, to }),
  });

  const totals = useMemo(() => aggregate(perfQ.data ?? []), [perfQ.data]);
  const osConv = adGroup.externalId
    ? osAttribution?.byAdGroupExternalId[adGroup.externalId]?.total ?? 0
    : 0;

  return (
    <>
      <tr
        className="border-t border-border cursor-pointer hover:bg-muted/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-2 py-2 text-muted-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{adGroup.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              ext {adGroup.externalId ?? "—"}
            </span>
          </div>
        </td>
        <td className="px-2 py-2">
          <StatusBadge status={adGroup.status} />
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {formatMoneyFromMicros(adGroup.cpcBidMicros ?? undefined)}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(totals.impressions)}</td>
        <td className="px-2 py-2 text-right tabular-nums">
          {formatNumber(totals.clicks)}{" "}
          <span className="text-muted-foreground">· {formatPercent(totals.ctr, 1)}</span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {formatMoneyFromMicros(totals.costMicros)}{" "}
          <span className="text-muted-foreground">
            · {formatMoneyFromMicros(totals.cpc)}
          </span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(totals.conversions, 0)}</td>
        <td className="px-3 py-2 text-right tabular-nums font-semibold">
          {formatNumber(osConv)}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/20">
          <td colSpan={9} className="px-3 py-3">
            <AdGroupDetail
              adGroup={adGroup}
              workspaceId={workspaceId}
              osAttribution={osAttribution}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AdGroupDetail({
  adGroup,
  workspaceId,
  osAttribution,
}: {
  adGroup: ChannelStructureAdGroup;
  workspaceId: string;
  osAttribution: OsAttribution | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Ads ({adGroup.ads.length})
        </div>
        {adGroup.ads.length === 0 ? (
          <EmptyState title="Keine Ads" />
        ) : (
          <div className="space-y-2">
            {adGroup.ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} workspaceId={workspaceId} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Keywords ({adGroup.keywords.filter((k) => !k.negative).length}){" "}
          {adGroup.keywords.filter((k) => k.negative).length > 0 ? (
            <>
              · Negatives (
              {adGroup.keywords.filter((k) => k.negative).length})
            </>
          ) : null}
        </div>
        {adGroup.keywords.length === 0 ? (
          <EmptyState title="Keine Keywords" />
        ) : (
          <KeywordTable
            keywords={adGroup.keywords}
            workspaceId={workspaceId}
            osAttribution={osAttribution}
          />
        )}
      </div>
    </div>
  );
}

function AdCard({
  ad,
  workspaceId,
}: {
  ad: ChannelStructureAd;
  workspaceId: string;
}) {
  const from = isoDate(daysAgo(30));
  const to = isoDate(todayEnd());
  const perfQ = useQuery({
    queryKey: ["ad-perf", ad.id, from, to],
    queryFn: () => api.channelAds.performance(ad.id, { workspaceId, from, to }),
  });
  const totals = useMemo(() => aggregate(perfQ.data ?? []), [perfQ.data]);

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{ad.type}</span>
          <StatusBadge status={ad.status} />
          {ad.policyApprovalStatus ? (
            <Badge variant="outline">{ad.policyApprovalStatus}</Badge>
          ) : null}
          <IdChip id={ad.id} />
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {formatNumber(totals.impressions)} Impr ·{" "}
            {formatNumber(totals.clicks)} Klicks ·{" "}
            {formatMoneyFromMicros(totals.costMicros)}
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">
              Headlines ({ad.headlines.length})
            </div>
            <ul className="space-y-0.5">
              {ad.headlines.map((h, i) => (
                <li key={i} className="font-mono">
                  · {h.text}
                  {h.pinnedField ? (
                    <span className="text-muted-foreground text-[10px] ml-1">
                      [{h.pinnedField}]
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">
              Descriptions ({ad.descriptions.length})
            </div>
            <ul className="space-y-0.5">
              {ad.descriptions.map((d, i) => (
                <li key={i} className="font-mono">
                  · {d.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {ad.finalUrls.length > 0 ? (
          <div className="text-[11px] text-muted-foreground">
            → {ad.finalUrls.join(", ")}
            {ad.path1 || ad.path2 ? (
              <span className="ml-1 font-mono">
                /{ad.path1 ?? ""}
                {ad.path2 ? `/${ad.path2}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KeywordTable({
  keywords,
  workspaceId,
  osAttribution,
}: {
  keywords: ChannelStructureKeyword[];
  workspaceId: string;
  osAttribution: OsAttribution | null;
}) {
  const from = isoDate(daysAgo(30));
  const to = isoDate(todayEnd());
  const perfQs = useQueries({
    queries: keywords.map((k) => ({
      queryKey: ["kw-perf", k.id, from, to],
      queryFn: () => api.channelKeywords.performance(k.id, { workspaceId, from, to }),
    })),
  });
  const perfById = new Map<string, ReturnType<typeof aggregate>>();
  keywords.forEach((k, i) => {
    perfById.set(k.id, aggregate(perfQs[i]?.data ?? []));
  });

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr className="text-[10px] text-muted-foreground uppercase tracking-wide">
            <th className="text-left font-medium px-3 py-1.5">Keyword</th>
            <th className="text-left font-medium px-2 py-1.5">Match</th>
            <th className="text-left font-medium px-2 py-1.5">Type</th>
            <th className="text-left font-medium px-2 py-1.5">Status</th>
            <th className="text-right font-medium px-2 py-1.5">CPC-Gebot</th>
            <th className="text-right font-medium px-2 py-1.5">Impr</th>
            <th className="text-right font-medium px-2 py-1.5">Klicks · CTR</th>
            <th className="text-right font-medium px-2 py-1.5">Spend · CPC</th>
            <th className="text-right font-medium px-3 py-1.5" title="OS-Outcomes attribuiert via utm_term">
              OS-Conv
            </th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => {
            const t = perfById.get(k.id) ?? emptyTotals();
            const osConv = osAttribution?.byKeywordText[k.text]?.total ?? 0;
            return (
              <tr key={k.id} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium">{k.text}</td>
                <td className="px-2 py-1.5">{k.matchType}</td>
                <td className="px-2 py-1.5">
                  <Badge variant={k.negative ? "danger" : "outline"}>
                    {k.negative ? "Negative" : "Positive"}
                  </Badge>
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={k.status} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatMoneyFromMicros(k.cpcBidMicros ?? undefined)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatNumber(t.impressions)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatNumber(t.clicks)}{" "}
                  <span className="text-muted-foreground">· {formatPercent(t.ctr, 1)}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatMoneyFromMicros(t.costMicros)}{" "}
                  <span className="text-muted-foreground">
                    · {formatMoneyFromMicros(t.cpc)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                  {formatNumber(osConv)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function emptyTotals() {
  return { impressions: 0, clicks: 0, conversions: 0, costMicros: 0, ctr: 0, cpc: 0 };
}

function aggregate(rows: PerformanceRow[]) {
  const t = rows.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.conversions += Number(r.conversions);
      acc.costMicros += Number(r.costMicros);
      return acc;
    },
    { impressions: 0, clicks: 0, conversions: 0, costMicros: 0 },
  );
  const ctr = t.impressions > 0 ? t.clicks / t.impressions : 0;
  const cpc = t.clicks > 0 ? t.costMicros / t.clicks : 0;
  return { ...t, ctr, cpc };
}
