"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { iconForEvent } from "@/components/activity/event-icon";
import type { ChangeEvent } from "@/lib/types";
import { Activity as ActivityIcon } from "lucide-react";

export function ActivityFeedWidget({
  events,
  loading,
  limit = 12,
}: {
  events: ChangeEvent[] | undefined;
  loading?: boolean;
  limit?: number;
}) {
  const shown = events?.slice(0, limit) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live-Activity</CardTitle>
            <CardDescription>Letzte {limit} Ereignisse</CardDescription>
          </div>
          <Link
            href="/activity"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Alle →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ActivityIcon size={24} />}
              title="Noch keine Aktivität"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((e) => {
              const { icon: Icon, tone } = iconForEvent(e.kind);
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div
                    className={`mt-0.5 size-6 shrink-0 grid place-items-center rounded-md ${tone}`}
                  >
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">
                      {e.summary}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <RelativeTime date={e.at} />
                      <span className="opacity-60">·</span>
                      <span className="font-mono">{e.kind}</span>
                      {e.actorId ? (
                        <>
                          <span className="opacity-60">·</span>
                          <IdChip id={e.actorId} />
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
