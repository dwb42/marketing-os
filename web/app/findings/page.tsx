"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { useFindingStatus } from "@/hooks/use-mutations";
import { api } from "@/lib/api";
import { Lightbulb, Check, X, RotateCcw, Archive } from "lucide-react";
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

  const mut = useFindingStatus(workspaceId);

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
                    items.map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        onSetStatus={(status) =>
                          mut.mutate({ findingId: f.id, status })
                        }
                        busy={mut.isPending}
                      />
                    ))
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

function FindingCard({
  finding: f,
  onSetStatus,
  busy,
}: {
  finding: Finding;
  onSetStatus: (status: FindingStatus) => void;
  busy?: boolean;
}) {
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
        <FindingActions status={f.status} onSetStatus={onSetStatus} busy={busy} />
      </CardContent>
    </Card>
  );
}

function FindingActions({
  status,
  onSetStatus,
  busy,
}: {
  status: FindingStatus;
  onSetStatus: (s: FindingStatus) => void;
  busy?: boolean;
}) {
  const next: Array<{ to: FindingStatus; label: string; icon: React.ElementType }> = [];
  if (status === "OPEN") {
    next.push({ to: "ADDRESSED", label: "Bearbeitet", icon: Check });
    next.push({ to: "WONT_FIX", label: "Wont-Fix", icon: X });
  } else if (status === "ADDRESSED") {
    next.push({ to: "OPEN", label: "Wieder öffnen", icon: RotateCcw });
    next.push({ to: "ARCHIVED", label: "Archiv", icon: Archive });
  } else if (status === "WONT_FIX") {
    next.push({ to: "OPEN", label: "Wieder öffnen", icon: RotateCcw });
  }
  if (next.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 pt-2 border-t border-border -mx-4 px-4">
      {next.map(({ to, label, icon: Icon }) => (
        <Button
          key={to}
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onSetStatus(to)}
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <Icon size={12} />
          {label}
        </Button>
      ))}
    </div>
  );
}
