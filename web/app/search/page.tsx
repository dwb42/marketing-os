"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { IdChip } from "@/components/common/id-chip";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
  const { workspaceId } = useSelectedWorkspace();
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["search", workspaceId, q],
    queryFn: () => api.search({ workspaceId, q }),
    enabled: !!workspaceId && q.length >= 2,
  });

  if (!workspaceId) return <EmptyState title="Kein Workspace ausgewählt" />;

  const r = query.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Suche" description="Über Campaigns, Assets, Cluster, Findings, Learnings" />

      <div className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Suche nach Name, Statement, Beobachtung…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.length < 2 ? (
        <EmptyState title="Mindestens 2 Zeichen eingeben" />
      ) : query.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : r ? (
        <div className="space-y-5">
          <Bucket title="Kampagnen" count={r.campaigns.length}>
            {r.campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns?id=${c.id}`} className="block hover:bg-muted/40 px-5 py-2.5 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm flex-1">{c.name}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{c.objective}</div>
              </Link>
            ))}
          </Bucket>

          <Bucket title="Cluster" count={r.clusters.length}>
            {r.clusters.map((c) => (
              <Link key={c.id} href={`/clusters?id=${c.id}`} className="block hover:bg-muted/40 px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm flex-1">{c.name}</span>
                  <StatusBadge status={c.validation} />
                </div>
                {c.lebenslage ? <div className="text-xs text-muted-foreground line-clamp-1">{c.lebenslage}</div> : null}
              </Link>
            ))}
          </Bucket>

          <Bucket title="Findings" count={r.findings.length}>
            {r.findings.map((f) => (
              <div key={f.id} className="px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm flex-1">{f.beobachtung}</span>
                  <StatusBadge status={f.konfidenz} />
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{f.empfehlung}</div>
              </div>
            ))}
          </Bucket>

          <Bucket title="Assets" count={r.assets.length}>
            {r.assets.map((a) => (
              <div key={a.id} className="px-5 py-2.5 flex items-center gap-2">
                <span className="text-sm flex-1">{a.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{a.kind}</span>
                <IdChip id={a.id} />
              </div>
            ))}
          </Bucket>

          <Bucket title="Learnings" count={r.learnings.length}>
            {r.learnings.map((l) => (
              <div key={l.id} className="px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1">{l.statement}</span>
                  <StatusBadge status={l.confidence} />
                </div>
              </div>
            ))}
          </Bucket>
        </div>
      ) : null}
    </div>
  );
}

function Bucket({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground font-normal tabular-nums">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border">{children}</CardContent>
    </Card>
  );
}
