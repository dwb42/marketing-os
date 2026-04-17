"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function SyncRunsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { workspaceId } = useSelectedWorkspace();
  const sp = useSearchParams();
  const selectedId = sp.get("id") ?? "";

  if (!workspaceId) return <EmptyState title="Kein Workspace ausgewählt" />;
  if (selectedId) return <SyncRunDetail id={selectedId} workspaceId={workspaceId} />;
  return <SyncRunsList workspaceId={workspaceId} />;
}

function SyncRunsList({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");

  const q = useQuery({
    queryKey: ["sync-runs", workspaceId, status, channel],
    queryFn: () =>
      api.syncRuns.list({
        workspaceId,
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
      }),
    enabled: !!workspaceId,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync-Runs"
        description="Jeder Push/Pull an ein externes Werbenetzwerk — mit Idempotency-Key und Fehlerdetails"
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 min-w-[140px] text-xs">
              <option value="">Alle Status</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNNING">RUNNING</option>
              <option value="SUCCEEDED">SUCCEEDED</option>
              <option value="FAILED">FAILED</option>
              <option value="PARTIAL">PARTIAL</option>
            </Select>
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-8 min-w-[140px] text-xs">
              <option value="">Alle Channels</option>
              <option value="GOOGLE_ADS">GOOGLE_ADS</option>
              <option value="META_ADS">META_ADS</option>
            </Select>
          </div>
        }
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <Card className="p-5 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</Card>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<RefreshCw size={24} />} title="Keine Sync-Runs" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="text-left font-medium px-5 py-2">Type</th>
                <th className="text-left font-medium px-2 py-2">Channel</th>
                <th className="text-left font-medium px-2 py-2">Target</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-left font-medium px-2 py-2">Error</th>
                <th className="text-right font-medium px-5 py-2">Wann</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link href={`/sync-runs?id=${s.id}`} className="text-xs font-mono font-medium hover:underline">
                      {s.type}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">{s.channel}</td>
                  <td className="px-2 py-2.5"><IdChip id={s.targetId} /></td>
                  <td className="px-2 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-2 py-2.5 text-xs text-red-600 dark:text-red-400 line-clamp-1 max-w-[300px]">
                    {s.errorKind ? `${s.errorKind}: ${s.errorMessage ?? ""}` : ""}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <RelativeTime date={s.createdAt} className="text-xs text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SyncRunDetail({ id, workspaceId }: { id: string; workspaceId: string }) {
  const q = useQuery({
    queryKey: ["sync-run", id, workspaceId],
    queryFn: () => api.syncRuns.get(id, workspaceId),
    enabled: !!workspaceId,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const s = q.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sync-runs" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Alle Sync-Runs
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold font-mono">{s.type}</h1>
          <StatusBadge status={s.status} />
          <span className="text-xs text-muted-foreground">{s.channel}</span>
        </div>
        <div className="mt-2"><IdChip id={s.id} /></div>
      </div>

      {s.errorKind ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-red-600 dark:text-red-400 font-semibold mb-1">
              {s.errorKind}
            </div>
            <div className="text-sm text-foreground font-mono whitespace-pre-wrap">
              {s.errorMessage}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Metadaten</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-2 font-mono">
            <Row label="Target" value={`${s.targetType} / ${s.targetId}`} />
            <Row label="Idempotency" value={s.idempotencyKey} />
            <Row label="Attempt" value={String(s.attempt)} />
            <Row label="Started" value={formatDateTime(s.startedAt)} />
            <Row label="Finished" value={formatDateTime(s.finishedAt)} />
            <Row label="Created" value={formatDateTime(s.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Input</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/40 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(s.input, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Output</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-muted/40 p-3 rounded overflow-auto max-h-96">
            {s.output ? JSON.stringify(s.output, null, 2) : "—"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right break-all">{value}</span>
    </div>
  );
}
