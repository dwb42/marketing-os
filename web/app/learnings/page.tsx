"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { BookOpen } from "lucide-react";

export default function LearningsPage() {
  const { workspaceId } = useSelectedWorkspace();
  const q = useQuery({
    queryKey: ["learnings", workspaceId],
    queryFn: () => api.learnings.list({ workspaceId }),
    enabled: !!workspaceId,
  });

  if (!workspaceId) return <EmptyState title="Kein Workspace ausgewählt" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learnings"
        description="Was wir aus Experimenten und Beobachtungen validiert wissen"
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<BookOpen size={24} />} title="Keine Learnings" />
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2 justify-between">
                  <div className="text-sm font-medium flex-1">{l.statement}</div>
                  <StatusBadge status={l.confidence} />
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                  <RelativeTime date={l.createdAt} />
                  {l.initiativeId ? <><span className="opacity-40">·</span><span>initiative</span><IdChip id={l.initiativeId} /></> : null}
                  {l.experimentId ? <><span className="opacity-40">·</span><span>experiment</span><IdChip id={l.experimentId} /></> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
