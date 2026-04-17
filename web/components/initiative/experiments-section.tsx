"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { IdChip } from "@/components/common/id-chip";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import {
  useExperimentStart,
  useExperimentConclude,
} from "@/hooks/use-mutations";
import type { Experiment } from "@/lib/types";
import { Play, Flag, Loader2 } from "lucide-react";

export function ExperimentsSection({
  initiativeId,
  workspaceId,
}: {
  initiativeId: string;
  workspaceId: string;
}) {
  const q = useQuery({
    queryKey: ["experiments", workspaceId, initiativeId],
    queryFn: () => api.experiments.list({ workspaceId, initiativeId }),
    enabled: !!workspaceId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experimente · {(q.data ?? []).length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState title="Keine Experimente" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((e) => (
              <ExperimentRow
                key={e.id}
                experiment={e}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ExperimentRow({
  experiment: e,
  workspaceId,
}: {
  experiment: Experiment;
  workspaceId: string;
}) {
  const start = useExperimentStart(workspaceId);
  const [concludeOpen, setConcludeOpen] = useState(false);

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-medium">{e.title}</div>
          <StatusBadge status={e.status} />
          <IdChip id={e.id} />
        </div>
        {e.description ? (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {e.description}
          </div>
        ) : null}
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          {e.startedAt ? <span>gestartet {formatDateTime(e.startedAt)}</span> : null}
          {e.endedAt ? <span>· endete {formatDateTime(e.endedAt)}</span> : null}
        </div>
        {e.conclusion ? (
          <div className="text-xs mt-2 rounded bg-muted/50 px-3 py-2 border-l-2 border-primary/50">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-2">
              Fazit
            </span>
            {e.conclusion}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {e.status === "DESIGN" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={start.isPending}
            onClick={() => start.mutate({ experimentId: e.id })}
          >
            {start.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Starten
          </Button>
        ) : null}
        {e.status === "RUNNING" || e.status === "ANALYZING" ? (
          <Button variant="outline" size="sm" onClick={() => setConcludeOpen(true)}>
            <Flag size={12} />
            Abschließen
          </Button>
        ) : null}
      </div>

      {concludeOpen ? (
        <ConcludeDialog
          open={concludeOpen}
          onOpenChange={setConcludeOpen}
          experimentId={e.id}
          workspaceId={workspaceId}
        />
      ) : null}
    </li>
  );
}

function ConcludeDialog({
  open,
  onOpenChange,
  experimentId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  experimentId: string;
  workspaceId: string;
}) {
  const [conclusion, setConclusion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const mut = useExperimentConclude(workspaceId);

  const submit = async () => {
    if (conclusion.trim().length === 0) {
      setErr("Fazit darf nicht leer sein");
      return;
    }
    try {
      await mut.mutateAsync({ experimentId, conclusion: conclusion.trim() });
      setConclusion("");
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Experiment abschließen" className="max-w-lg">
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Free-Text-Fazit. Konkrete Learnings solltest du separat als Learning
          erfassen (folgende Iteration).
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fazit</label>
          <textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            rows={5}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Was wurde bestätigt / widerlegt? Nächster Schritt?"
          />
        </div>
        {err ? (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono border border-red-500/20 bg-red-500/5 rounded p-2">
            {err}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Abschließen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
