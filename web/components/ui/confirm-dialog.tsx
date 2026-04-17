"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * Generic confirm dialog. Two variants:
 *
 * - "normal": a blue "Bestätigen" button.
 * - "danger": a red button. If `requireTyping` is set, the user must type
 *   that exact string to enable the button (Vercel/GitHub-style "type the
 *   repo name to confirm").
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  variant = "normal",
  requireTyping,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "normal" | "danger";
  requireTyping?: string;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const canConfirm = requireTyping ? typed === requireTyping : true;

  const handle = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setErr(null);
          setTyped("");
          onOpenChange(v);
        }
      }}
      className="max-w-md"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          {variant === "danger" ? (
            <div className="size-8 rounded-full bg-red-500/10 grid place-items-center text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle size={16} />
            </div>
          ) : null}
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? (
              <div className="text-sm text-muted-foreground mt-1">{description}</div>
            ) : null}
          </div>
        </div>

        {children ? <div>{children}</div> : null}

        {requireTyping ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Tippe <span className="font-mono font-medium text-foreground">{requireTyping}</span> zum Bestätigen:
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="font-mono text-xs"
              autoFocus
            />
          </div>
        ) : null}

        {err ? (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono break-words border border-red-500/20 bg-red-500/5 rounded p-2">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "primary"}
            onClick={handle}
            disabled={busy || !canConfirm}
            className={cn(!canConfirm && "opacity-60")}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
