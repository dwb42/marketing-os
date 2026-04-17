"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdChip } from "@/components/common/id-chip";
import { StatusBadge } from "@/components/common/status-badge";
import { InitiativeTimeline } from "@/components/initiative/initiative-timeline";
import { InitiativePerformance } from "@/components/initiative/initiative-performance";
import { ExperimentsSection } from "@/components/initiative/experiments-section";
import { AddAnnotationButton } from "@/components/annotations/add-annotation-button";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { ArrowLeft, Target, FlaskConical } from "lucide-react";

export default function InitiativesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { workspaceId } = useSelectedWorkspace();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id") ?? "";

  if (!workspaceId) return <EmptyState title="Kein Workspace ausgewählt" />;

  if (selectedId) {
    return <InitiativeDetail initiativeId={selectedId} workspaceId={workspaceId} />;
  }

  return <InitiativesList workspaceId={workspaceId} />;
}

function InitiativesList({ workspaceId }: { workspaceId: string }) {
  const q = useQuery({
    queryKey: ["initiatives", workspaceId],
    queryFn: () => api.initiatives.list({ workspaceId }),
    enabled: !!workspaceId,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Initiativen"
        description="Strategische Stossrichtungen mit Hypothese, Learn-Questions und Success-Criteria"
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Target size={24} />} title="Keine Initiativen" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(q.data ?? []).map((ini) => (
            <Link key={ini.id} href={`/initiatives?id=${ini.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-medium text-sm flex-1">{ini.title}</div>
                    <StatusBadge status={ini.status} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {ini.goal}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                    {ini.modules && ini.modules.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {ini.modules.slice(0, 3).map((m) => (
                          <span key={m} className="font-mono px-1.5 py-0.5 rounded bg-muted">
                            {m}
                          </span>
                        ))}
                        {ini.modules.length > 3 ? (
                          <span>+{ini.modules.length - 3}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InitiativeDetail({ initiativeId, workspaceId }: { initiativeId: string; workspaceId: string }) {
  const q = useQuery({
    queryKey: ["initiative-timeline", initiativeId, workspaceId],
    queryFn: () => api.initiatives.timeline(initiativeId, workspaceId),
    enabled: !!workspaceId,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }

  const { initiative, campaigns, events, annotations, performance, learnings, hypotheses } = q.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/initiatives" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Alle Initiativen
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{initiative.title}</h1>
          <StatusBadge status={initiative.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{initiative.goal}</p>
        <div className="mt-2">
          <IdChip id={initiative.id} />
        </div>
      </div>

      <InitiativePerformance rows={performance} />

      {initiative.hypothesis ? (
        <Card>
          <CardHeader>
            <CardTitle>Leit-Hypothese</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{initiative.hypothesis}</CardContent>
        </Card>
      ) : null}

      {hypotheses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Hypothesen · {hypotheses.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {hypotheses.map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium flex-1">{h.statement}</div>
                    <IdChip id={h.id} />
                  </div>
                  {h.rationale ? (
                    <div className="text-xs text-muted-foreground mt-1">{h.rationale}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ExperimentsSection initiativeId={initiative.id} workspaceId={workspaceId} />

      <Card>
        <CardHeader>
          <CardTitle>Verknüpfte Kampagnen · {campaigns.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <div className="p-5"><EmptyState title="Keine Kampagnen" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {campaigns.map((c) => (
                <li key={c.id} className="px-5 py-3 hover:bg-muted/40 flex items-center justify-between">
                  <div>
                    <Link href={`/campaigns?id=${c.id}`} className="text-sm font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.objective}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Timeline</h2>
          <AddAnnotationButton
            workspaceId={workspaceId}
            subjectType="INITIATIVE"
            subjectId={initiative.id}
          />
        </div>
        <InitiativeTimeline events={events} annotations={annotations} />
      </div>

      {learnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Learnings · {learnings.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {learnings.map((l) => (
                <li key={l.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium flex-1">{l.statement}</div>
                    <StatusBadge status={l.confidence} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
