"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import type { Campaign } from "@/lib/types";
import { Megaphone } from "lucide-react";

export function CampaignTable({
  campaigns,
  loading,
}: {
  campaigns: Campaign[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-5 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone size={24} />}
        title="Keine Kampagnen"
        description="In diesem Workspace sind noch keine Kampagnen vorhanden."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="text-left font-medium px-5 py-2.5">Name</th>
            <th className="text-left font-medium px-2 py-2.5">Status</th>
            <th className="text-left font-medium px-2 py-2.5">Objective</th>
            <th className="text-left font-medium px-2 py-2.5">Initiative</th>
            <th className="text-right font-medium px-5 py-2.5">Aktualisiert</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
            >
              <td className="px-5 py-2.5">
                <Link
                  href={`/campaigns?id=${c.id}`}
                  className="text-foreground font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <div className="mt-0.5">
                  <IdChip id={c.id} />
                </div>
              </td>
              <td className="px-2 py-2.5">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-2 py-2.5 max-w-[280px]">
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {c.objective}
                </div>
              </td>
              <td className="px-2 py-2.5">
                {c.initiativeId ? <IdChip id={c.initiativeId} /> : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-5 py-2.5 text-right">
                <RelativeTime
                  date={c.updatedAt}
                  className="text-xs text-muted-foreground"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
