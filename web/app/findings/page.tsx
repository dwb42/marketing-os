"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdChip } from "@/components/common/id-chip";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { Lightbulb } from "lucide-react";
import type { Finding, FindingStatus } from "@/lib/types";

const COLUMNS: Array<{ status: FindingStatus; title: string }> = [
  { status: "OPEN", title: "Offen" },
  { status: "ADDRESSED", title: "Bearbeitet" },
  { status: "WONT_FIX", title: "Wont-Fix" },
];

export default function FindingsPage() {
  const { workspaceId } = useSelectedWorkspace();
  const [confidenceFilter, setConfidenceFilter] = useState("");

  const q = useQuery({
    queryKey: ["findings-all", workspaceId],
    queryFn: () => api.findings.list({ workspaceId }),
    enabled: !!workspaceId,
  });

  if (!workspaceId) return <EmptyState title="Kein Workspace ausgewählt" />;

  const filtered = (q.data ?? []).filter(
    (f) => !confidenceFilter || f.konfidenz === confidenceFilter,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description="Was der Agent beobachtet hat, interpretiert und empfiehlt"
        actions={
          <Select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="h-8 min-w-[160px] text-xs"
          >
            <option value="">Alle Konfidenzen</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </Select>
        }
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Lightbulb size={24} />} title="Keine Findings" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = filtered.filter((f) => f.status === col.status);
            return (
              <div key={col.status} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.title}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Leer
                    </div>
                  ) : (
                    items.map((f) => <FindingCard key={f.id} finding={f} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding: f }: { finding: Finding }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-2 justify-between">
          <div className="text-sm font-medium flex-1">{f.beobachtung}</div>
          <StatusBadge status={f.konfidenz} />
        </div>
        <div className="text-xs text-muted-foreground line-clamp-3">
          <span className="font-semibold uppercase tracking-wider text-[10px] mr-1">Interpretation</span>
          {f.interpretation}
        </div>
        <div className="text-xs line-clamp-3">
          <span className="font-semibold uppercase tracking-wider text-[10px] mr-1 text-muted-foreground">Empfehlung</span>
          {f.empfehlung}
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-muted-foreground">
          {f.modulBetroffen ? (
            <span className="font-mono">modul:{f.modulBetroffen}</span>
          ) : null}
          {f.empfehlungAn ? <span>→ {f.empfehlungAn}</span> : null}
          <RelativeTime date={f.createdAt} />
        </div>
      </CardContent>
    </Card>
  );
}
