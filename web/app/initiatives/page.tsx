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
import { RelativeTime } from "@/components/common/relative-time";
import { iconForEvent } from "@/components/activity/event-icon";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { ArrowLeft, Target } from "lucide-react";

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

  return <InitiativesList />;
}

function InitiativesList() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Initiativen"
        description="Strategische Stossrichtungen mit Hypothese, Learn-Questions und Success-Criteria"
      />
      <EmptyState
        icon={<Target size={24} />}
        title="Initiative-Liste noch nicht verfügbar"
        description="Das Backend hat aktuell nur POST /initiatives und GET /initiatives/:id/timeline. Öffne eine Initiative direkt per ?id=ini_…"
      />
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

  const { initiative, campaigns, events, learnings } = q.data;

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

      {initiative.hypothesis ? (
        <Card>
          <CardHeader>
            <CardTitle>Hypothese</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{initiative.hypothesis}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Verknüpfte Kampagnen</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-5"><EmptyState title="Noch keine Events" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {events.slice().reverse().map((e) => {
                const { icon: Icon, tone } = iconForEvent(e.kind);
                return (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 size-6 shrink-0 grid place-items-center rounded-md ${tone}`}>
                      <Icon size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{e.summary}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <RelativeTime date={e.at} /> · <span className="font-mono">{e.kind}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {learnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Learnings</CardTitle>
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
