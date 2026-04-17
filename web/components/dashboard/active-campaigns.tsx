"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { Sparkline } from "./sparkline";
import { EmptyState } from "@/components/common/empty-state";
import { formatNumber, formatMoneyFromMicros, formatPercent } from "@/lib/format";
import { Megaphone } from "lucide-react";

interface Row {
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

export function ActiveCampaignsWidget({
  rows,
  loading,
}: {
  rows: Row[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Aktive Kampagnen</CardTitle>
            <CardDescription>Synced / Paused · letzte 14 Tage</CardDescription>
          </div>
          <Link
            href="/campaigns"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Alle →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Megaphone size={24} />}
              title="Keine aktiven Kampagnen"
              description="Sobald eine Kampagne gesynct ist, erscheint sie hier."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="text-left font-medium px-5 py-2">Name</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">Impr.</th>
                <th className="text-right font-medium px-2 py-2">Klicks</th>
                <th className="text-right font-medium px-2 py-2">CTR</th>
                <th className="text-right font-medium px-2 py-2">Spend</th>
                <th className="text-right font-medium px-5 py-2 w-28">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
                return (
                  <tr
                    key={r.channelCampaignId}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-foreground truncate max-w-[240px]">
                        {r.campaignName}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.channel} · {r.externalId ?? "—"}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatNumber(r.impressions)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatNumber(r.clicks)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatPercent(ctr, 1)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatMoneyFromMicros(r.costMicros)}
                    </td>
                    <td className="px-5 py-2.5 w-28">
                      <div className="h-6 text-primary">
                        <Sparkline values={r.sparkline} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
