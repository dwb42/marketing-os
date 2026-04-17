"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdChip } from "@/components/common/id-chip";
import { StatusBadge } from "@/components/common/status-badge";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { ArrowLeft, Layers } from "lucide-react";

export default function ClustersPage() {
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
  if (selectedId) return <ClusterDetail clusterId={selectedId} workspaceId={workspaceId} />;

  return <ClustersList workspaceId={workspaceId} />;
}

function ClustersList({ workspaceId }: { workspaceId: string }) {
  const [validation, setValidation] = useState("");

  const q = useQuery({
    queryKey: ["clusters", workspaceId, validation],
    queryFn: () =>
      api.clusters.list({
        workspaceId,
        ...(validation ? { validation } : {}),
      }),
    enabled: !!workspaceId,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intent-Cluster"
        description="Semantische Nutzergruppen mit Validation-Lifecycle"
        actions={
          <Select
            value={validation}
            onChange={(e) => setValidation(e.target.value)}
            className="h-8 min-w-[180px] text-xs"
          >
            <option value="">Alle Validations</option>
            <option value="HYPOTHESIS">HYPOTHESIS</option>
            <option value="WEAK_EVIDENCE">WEAK_EVIDENCE</option>
            <option value="EVIDENCED">EVIDENCED</option>
            <option value="REFUTED">REFUTED</option>
          </Select>
        }
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <Card className="p-5 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </Card>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Layers size={24} />} title="Keine Cluster" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(q.data ?? []).map((c) => (
            <Link key={c.id} href={`/clusters?id=${c.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={c.validation} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Modul · <span className="font-mono">{c.modulPrimary}</span>
                  </div>
                  {c.lebenslage ? (
                    <div className="text-xs text-foreground line-clamp-2 mb-2">{c.lebenslage}</div>
                  ) : null}
                  {c.suchbegriffe?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.suchbegriffe.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {t}
                        </span>
                      ))}
                      {c.suchbegriffe.length > 4 ? (
                        <span className="text-[10px] text-muted-foreground">+{c.suchbegriffe.length - 4}</span>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ClusterDetail({ clusterId, workspaceId }: { clusterId: string; workspaceId: string }) {
  const q = useQuery({
    queryKey: ["cluster", clusterId, workspaceId],
    queryFn: () => api.clusters.get(clusterId, workspaceId),
    enabled: !!workspaceId,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const c = q.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clusters" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Alle Cluster
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{c.name}</h1>
          <StatusBadge status={c.validation} />
          <StatusBadge status={c.status} />
        </div>
        <div className="mt-2"><IdChip id={c.id} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Kontext</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <Row label="Modul primär" value={<span className="font-mono">{c.modulPrimary}</span>} />
            {c.modulSecondary?.length > 0 ? (
              <Row label="Modul sekundär" value={<span className="font-mono">{c.modulSecondary.join(", ")}</span>} />
            ) : null}
            {c.outcome ? <Row label="Ziel-Outcome" value={<span className="font-mono">{c.outcome}</span>} /> : null}
            {c.lebenslage ? <Row label="Lebenslage" value={c.lebenslage} /> : null}
            {c.naechsteAktion ? <Row label="Nächste Aktion" value={c.naechsteAktion} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Suchbegriffe · Friktion</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex flex-wrap gap-1">
              {c.suchbegriffe.map((t) => (
                <span key={t} className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">
                  {t}
                </span>
              ))}
            </div>
            {c.friktionspunkte?.length ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 mt-3">Friktion</div>
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {c.friktionspunkte.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {c.findings && c.findings.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {c.findings.map((f) => (
                <li key={f.id} className="px-5 py-3">
                  <div className="flex items-start gap-2 justify-between">
                    <div className="text-sm font-medium flex-1">{f.beobachtung}</div>
                    <div className="flex gap-1 shrink-0">
                      <StatusBadge status={f.konfidenz} />
                      <StatusBadge status={f.status} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{f.empfehlung}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
