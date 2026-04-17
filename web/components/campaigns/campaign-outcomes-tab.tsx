"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { RelativeTime } from "@/components/common/relative-time";
import { api } from "@/lib/api";
import { daysAgo, todayEnd, isoDate, formatNumber, formatPercent } from "@/lib/format";
import { useSelectedProduct } from "@/hooks/use-workspace";
import type { Campaign } from "@/lib/types";
import { TrendingUp, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

/**
 * Shows outcomes attributed to THIS campaign, i.e. events whose
 * utm_campaign matches the value parsed out of the campaign's target-URL
 * asset.
 *
 * Requires a product to be selected (outcomes are product-scoped). We
 * fetch asset versions for each linked asset, find the first one whose
 * content.targetUrl has a utm_campaign param, and filter the outcomes by
 * that value.
 */
export function CampaignOutcomesTab({
  campaign,
  workspaceId,
}: {
  campaign: Campaign;
  workspaceId: string;
}) {
  const { productId, products } = useSelectedProduct(workspaceId);

  // Pull all asset versions so we can find the target URL.
  const assetIds = campaign.campaignAssets?.map((ca) => ca.assetId) ?? [];
  const versionsQueries = useQueries({
    queries: assetIds.map((id) => ({
      queryKey: ["asset-versions", id, workspaceId],
      queryFn: () => api.assets.versions(id, workspaceId),
      enabled: !!workspaceId,
    })),
  });

  const { targetUrl, utmCampaign } = useMemo(() => {
    for (const q of versionsQueries) {
      const versions = q.data ?? [];
      // Prefer APPROVED/PUBLISHED version, fall back to latest.
      const sorted = versions.slice().sort((a, b) => b.versionNum - a.versionNum);
      const pick = sorted.find((v) => v.status !== "DRAFT") ?? sorted[0];
      if (!pick) continue;
      const c = (pick.content ?? {}) as Record<string, unknown>;
      const url = typeof c.targetUrl === "string" ? c.targetUrl : "";
      if (!url) continue;
      try {
        const u = new URL(url);
        const utm = u.searchParams.get("utm_campaign");
        if (utm) return { targetUrl: url, utmCampaign: utm };
      } catch {
        // ignore unparseable URLs
      }
    }
    return { targetUrl: null as string | null, utmCampaign: null as string | null };
  }, [versionsQueries]);

  const versionsLoading = versionsQueries.some((q) => q.isLoading);

  const from = isoDate(daysAgo(30));
  const to = isoDate(todayEnd());

  const eventsQ = useQuery({
    queryKey: ["outcomes-for-campaign", productId, from, to, utmCampaign],
    queryFn: () => api.outcomes.query({ productId, from, to }),
    enabled: !!productId && !!utmCampaign,
  });

  const matchedEvents = useMemo(() => {
    if (!utmCampaign || !eventsQ.data) return [];
    return eventsQ.data.filter((e) => {
      const utm = (e.attribution as Record<string, unknown>)?.utm_campaign;
      return utm === utmCampaign;
    });
  }, [eventsQ.data, utmCampaign]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of matchedEvents) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [matchedEvents]);

  const maxCount = Math.max(...byType.map(([, c]) => c), 1);

  if (!productId) {
    return (
      <Card>
        <CardContent className="p-5">
          <EmptyState
            icon={<SettingsIcon size={24} />}
            title="Kein Product ausgewählt"
            description={
              products.length === 0
                ? "Es gibt kein Product im Workspace."
                : "Outcomes sind product-scoped — wähle in den Settings ein Product."
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (versionsLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!utmCampaign) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardContent className="p-5 flex items-start gap-3">
          <div className="size-8 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 grid place-items-center shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="text-sm space-y-1">
            <div className="font-medium">Kein utm_campaign in den Assets gefunden.</div>
            <div className="text-xs text-muted-foreground max-w-lg">
              Damit Outcomes dieser Campaign zugeordnet werden können, muss eine
              der verknüpften Asset-Versionen ein{" "}
              <code className="font-mono">targetUrl</code>-Feld mit einem{" "}
              <code className="font-mono">?utm_campaign=…</code> Parameter
              enthalten.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Attribution</CardTitle>
          <CardDescription>Ausgelesen aus Target-URL der Assets</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              utm_campaign
            </span>
            <code className="font-mono text-xs px-2 py-0.5 bg-muted rounded">
              {utmCampaign}
            </code>
          </div>
          {targetUrl ? (
            <div className="text-[11px] text-muted-foreground font-mono break-all">
              {targetUrl}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Funnel · letzte 30 Tage</CardTitle>
              <CardDescription>
                {matchedEvents.length} Events zugeordnet ·{" "}
                {new Set(matchedEvents.map((e) => e.sessionRef).filter(Boolean)).size}{" "}
                Sessions
              </CardDescription>
            </div>
            <Link
              href={`/outcomes?type=`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Alle Outcomes →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : byType.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={24} />}
              title="Keine zugeordneten Outcomes"
              description={`Noch kein Event mit utm_campaign=${utmCampaign} im Zeitraum.`}
            />
          ) : (
            <div className="space-y-2">
              {byType.map(([type, count], idx) => {
                const pct = count / maxCount;
                const prev = idx > 0 ? byType[idx - 1][1] : 0;
                const conv = idx > 0 && prev > 0 ? count / prev : null;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{type}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        {conv !== null ? (
                          <span className="text-muted-foreground">
                            Conv {formatPercent(conv, 0)}
                          </span>
                        ) : null}
                        <span className="text-foreground font-semibold">
                          {formatNumber(count)}
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

      <Card>
        <CardHeader>
          <CardTitle>Letzte Events · {matchedEvents.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {matchedEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Keine Events" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {matchedEvents.slice(0, 30).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="font-medium">{e.type}</span>
                  <span className="text-[11px] text-muted-foreground font-mono flex-1 truncate">
                    {e.sessionRef ?? "—"}
                  </span>
                  <RelativeTime
                    date={e.occurredAt}
                    className="text-[11px] text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
