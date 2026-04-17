"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import type { OutcomeEvent } from "@/lib/types";

interface Group {
  key: string;
  total: number;
  byType: Map<string, number>;
  lastOccurredAt: string;
  sessions: Set<string>;
}

/**
 * Groups outcome events by a chosen attribution field (utm_campaign or
 * utm_source) and renders one card per group with an inline funnel of
 * event-type counts. Unknown-attribution events land in a "(ohne
 * Attribution)" bucket so nothing is silently dropped.
 */
export function AttributionGroups({
  events,
  by,
  loading,
  funnelOrder,
}: {
  events: OutcomeEvent[];
  by: "utm_campaign" | "utm_source" | "utm_medium";
  loading?: boolean;
  funnelOrder?: string[];
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const e of events) {
      const attr = (e.attribution ?? {}) as Record<string, unknown>;
      const raw = typeof attr[by] === "string" ? (attr[by] as string) : "";
      const key = raw || "(ohne Attribution)";
      const g =
        m.get(key) ??
        ({
          key,
          total: 0,
          byType: new Map<string, number>(),
          lastOccurredAt: "",
          sessions: new Set<string>(),
        } as Group);
      g.total += 1;
      g.byType.set(e.type, (g.byType.get(e.type) ?? 0) + 1);
      if (e.sessionRef) g.sessions.add(e.sessionRef);
      if (!g.lastOccurredAt || e.occurredAt > g.lastOccurredAt) {
        g.lastOccurredAt = e.occurredAt;
      }
      m.set(key, g);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [events, by]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp size={24} />}
        title="Keine Events im Zeitraum"
      />
    );
  }

  // Determine funnel ordering: either explicit, or derived from observed types
  // by frequency across all groups.
  const orderedTypes = useMemo<string[]>(() => {
    if (funnelOrder && funnelOrder.length > 0) return funnelOrder;
    const total = new Map<string, number>();
    for (const g of groups) {
      for (const [t, c] of g.byType) total.set(t, (total.get(t) ?? 0) + c);
    }
    return Array.from(total.keys()).sort(
      (a, b) => (total.get(b) ?? 0) - (total.get(a) ?? 0),
    );
  }, [groups, funnelOrder]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} orderedTypes={orderedTypes} />
      ))}
    </div>
  );
}

function GroupCard({ group: g, orderedTypes }: { group: Group; orderedTypes: string[] }) {
  const typesInGroup = orderedTypes.filter((t) => g.byType.has(t));
  const maxCount = Math.max(...Array.from(g.byType.values()), 1);
  const anonymous = g.key === "(ohne Attribution)";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div
              className={`text-sm font-semibold truncate ${
                anonymous ? "text-muted-foreground italic" : "font-mono"
              }`}
            >
              {g.key}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
              <span className="tabular-nums">{g.sessions.size} Sessions</span>
              <span className="opacity-40">·</span>
              <span>zuletzt {formatRelative(g.lastOccurredAt)}</span>
            </div>
          </div>
          <div className="text-lg font-semibold tabular-nums shrink-0">
            {formatNumber(g.total)}
          </div>
        </div>

        <div className="space-y-1.5">
          {typesInGroup.map((t, idx) => {
            const count = g.byType.get(t) ?? 0;
            const pct = count / maxCount;
            const prev = idx > 0 ? g.byType.get(typesInGroup[idx - 1]) ?? 0 : 0;
            const conv = idx > 0 && prev > 0 ? count / prev : null;
            return (
              <div key={t}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-foreground font-medium truncate">{t}</span>
                  <div className="flex items-center gap-2 tabular-nums shrink-0">
                    {conv !== null ? (
                      <span className="text-muted-foreground">
                        {formatPercent(conv, 0)}
                      </span>
                    ) : null}
                    <span className="text-foreground">{formatNumber(count)}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-sm transition-all"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
