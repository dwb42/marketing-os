"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateAnnotation } from "@/hooks/use-mutations";

/**
 * Button + inline dialog to add an Annotation to any subject. Subject is
 * bound by caller (subjectType + subjectId). occurredAt defaults to now
 * but can be edited — useful for retroactive context ("Variant A live
 * seit 14:00").
 */
export function AddAnnotationButton({
  workspaceId,
  subjectType,
  subjectId,
  label = "Annotation hinzufügen",
}: {
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return toLocalDatetime(d);
  });
  const [pinned, setPinned] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mut = useCreateAnnotation(workspaceId);

  const submit = async () => {
    setErr(null);
    if (body.trim().length === 0) {
      setErr("Body darf nicht leer sein");
      return;
    }
    try {
      await mut.mutateAsync({
        subjectType,
        subjectId,
        body: body.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        pinned,
      });
      setBody("");
      setPinned(false);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus size={13} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !mut.isPending && setOpen(v)} title="Annotation hinzufügen" className="max-w-lg">
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Freitext-Marker auf der Timeline. Nützlich für Kontext zu
            Events — "Variant A live seit 14:00", "Policy-Review
            abgeschlossen", etc.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Was ist passiert / warum ist das relevant?"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Zeitpunkt</label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="text-xs"
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="accent-primary"
              />
              <span>Pinnen (für wichtige Marker)</span>
            </label>
          </div>

          <div className="text-[11px] text-muted-foreground font-mono">
            Subject: {subjectType} · {subjectId}
          </div>

          {err ? (
            <div className="text-xs text-red-600 dark:text-red-400 font-mono border border-red-500/20 bg-red-500/5 rounded p-2">
              {err}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mut.isPending}>
              Abbrechen
            </Button>
            <Button onClick={submit} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
