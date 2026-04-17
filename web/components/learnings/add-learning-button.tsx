"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCreateLearning } from "@/hooks/use-mutations";
import { BookOpenText, Loader2, Plus, Trash2 } from "lucide-react";

type EvidenceType =
  | "PERFORMANCE_WINDOW"
  | "EXPERIMENT"
  | "OUTCOME_WINDOW"
  | "ANNOTATION"
  | "FINDING"
  | "OTHER";

interface EvidenceRow {
  type: EvidenceType;
  ref: string;
  note: string;
}

/**
 * Button + dialog to create a Learning. Accepts optional bindings
 * (initiativeId / hypothesisId / experimentId) that are pre-filled into
 * the submission; experimentId is also auto-added as the first evidence
 * row when provided.
 */
export function AddLearningButton({
  workspaceId,
  initiativeId,
  hypothesisId,
  experimentId,
  label = "Learning erfassen",
  variant = "outline",
  autoOpen,
  onClosed,
}: {
  workspaceId: string;
  initiativeId?: string;
  hypothesisId?: string;
  experimentId?: string;
  label?: string;
  variant?: "outline" | "primary";
  autoOpen?: boolean;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(!!autoOpen);

  const handleChange = (v: boolean) => {
    setOpen(v);
    if (!v) onClosed?.();
  };

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <BookOpenText size={13} />
        {label}
      </Button>
      {open ? (
        <LearningDialog
          open={open}
          onOpenChange={handleChange}
          workspaceId={workspaceId}
          initiativeId={initiativeId}
          hypothesisId={hypothesisId}
          experimentId={experimentId}
        />
      ) : null}
    </>
  );
}

function LearningDialog({
  open,
  onOpenChange,
  workspaceId,
  initiativeId,
  hypothesisId,
  experimentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  initiativeId?: string;
  hypothesisId?: string;
  experimentId?: string;
}) {
  const mut = useCreateLearning(workspaceId);
  const [statement, setStatement] = useState("");
  const [confidence, setConfidence] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [evidence, setEvidence] = useState<EvidenceRow[]>(
    experimentId
      ? [{ type: "EXPERIMENT", ref: experimentId, note: "" }]
      : [],
  );
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (statement.trim().length === 0) {
      setErr("Statement darf nicht leer sein");
      return;
    }
    try {
      await mut.mutateAsync({
        statement: statement.trim(),
        confidence,
        evidence: evidence
          .filter((e) => e.ref.trim().length > 0)
          .map((e) => ({
            type: e.type,
            ref: e.ref.trim(),
            ...(e.note.trim() ? { note: e.note.trim() } : {}),
          })),
        ...(initiativeId ? { initiativeId } : {}),
        ...(hypothesisId ? { hypothesisId } : {}),
        ...(experimentId ? { experimentId } : {}),
      });
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mut.isPending && onOpenChange(v)} title="Learning erfassen" className="max-w-xl">
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Was wissen wir jetzt, das wir vorher nicht wussten? Konfidenz +
          Evidenz machen das Learning später nachprüfbar.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Statement</label>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Variant A schlägt B bei Chat-Start deutlich (+18%)."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Konfidenz</label>
            <Select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
              className="text-xs"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Verknüpfung</label>
            <div className="text-[11px] text-muted-foreground font-mono pt-2 space-y-0.5">
              {initiativeId ? <div>initiative: {initiativeId}</div> : null}
              {hypothesisId ? <div>hypothesis: {hypothesisId}</div> : null}
              {experimentId ? <div>experiment: {experimentId}</div> : null}
              {!initiativeId && !hypothesisId && !experimentId ? (
                <div className="italic text-muted-foreground/70">—</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Evidenz</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setEvidence((xs) => [...xs, { type: "OTHER", ref: "", note: "" }])
              }
              className="text-xs h-7"
            >
              <Plus size={12} /> Evidenz
            </Button>
          </div>
          {evidence.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic border border-dashed border-border rounded p-3 text-center">
              Keine Evidenz angegeben — optional, aber stark empfohlen
            </div>
          ) : (
            <div className="space-y-1.5">
              {evidence.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Select
                    value={row.type}
                    onChange={(e) =>
                      setEvidence((xs) =>
                        xs.map((x, j) =>
                          j === i ? { ...x, type: e.target.value as EvidenceType } : x,
                        ),
                      )
                    }
                    className="h-8 text-xs w-[140px] shrink-0"
                  >
                    <option value="EXPERIMENT">EXPERIMENT</option>
                    <option value="PERFORMANCE_WINDOW">PERFORMANCE_WINDOW</option>
                    <option value="OUTCOME_WINDOW">OUTCOME_WINDOW</option>
                    <option value="ANNOTATION">ANNOTATION</option>
                    <option value="FINDING">FINDING</option>
                    <option value="OTHER">OTHER</option>
                  </Select>
                  <Input
                    placeholder="ref (z.B. exp_… oder chat_started:2026-04-01..2026-04-14)"
                    value={row.ref}
                    onChange={(e) =>
                      setEvidence((xs) =>
                        xs.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)),
                      )
                    }
                    className="h-8 text-xs font-mono flex-1"
                  />
                  <Input
                    placeholder="note (optional)"
                    value={row.note}
                    onChange={(e) =>
                      setEvidence((xs) =>
                        xs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                      )
                    }
                    className="h-8 text-xs w-[140px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEvidence((xs) => xs.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-red-500 p-1.5"
                    title="Entfernen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {err ? (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono border border-red-500/20 bg-red-500/5 rounded p-2">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Erfassen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
