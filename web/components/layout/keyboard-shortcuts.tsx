"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCmdk } from "@/components/cmd-k/context";

/**
 * Global keyboard-shortcut handler.
 *
 * Shortcuts:
 *   g d    → Dashboard
 *   g a    → Activity
 *   g c    → Campaigns
 *   g i    → Initiatives
 *   g l    → Clusters (intent-cluster)
 *   g f    → Findings
 *   g r    → Learnings (remembered)
 *   g p    → Performance
 *   g o    → Outcomes
 *   g s    → Sync-Runs
 *   g e    → Settings (einstellungen)
 *   ?      → Show cheatsheet
 *
 * ⌘K / Ctrl+K is handled in CmdkProvider — do not duplicate here.
 *
 * Shortcuts are disabled while a text input/editable element has focus.
 */
const G_ROUTES: Record<string, string> = {
  d: "/",
  a: "/activity",
  c: "/campaigns",
  i: "/initiatives",
  l: "/clusters",
  f: "/findings",
  r: "/learnings",
  p: "/performance",
  o: "/outcomes",
  s: "/sync-runs",
  e: "/settings",
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const { open: cmdkOpen } = useCmdk();
  const [cheatsheet, setCheatsheet] = useState(false);
  const waitingForG = useRef(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearG = () => {
      waitingForG.current = false;
      if (gTimeout.current) {
        clearTimeout(gTimeout.current);
        gTimeout.current = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (cmdkOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const k = e.key.toLowerCase();

      if (waitingForG.current) {
        const route = G_ROUTES[k];
        clearG();
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }

      if (k === "g") {
        e.preventDefault();
        waitingForG.current = true;
        gTimeout.current = setTimeout(clearG, 1200);
        return;
      }

      if (k === "?") {
        e.preventDefault();
        setCheatsheet((v) => !v);
        return;
      }

      if (k === "escape") {
        setCheatsheet(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearG();
    };
  }, [router, cmdkOpen]);

  if (!cheatsheet) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCheatsheet(false);
      }}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="px-5 h-11 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tastatur-Shortcuts</h2>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="p-5 text-sm space-y-4">
          <Group title="Navigation">
            <Row keys={["⌘", "K"]} label="Command-Palette öffnen" />
            <Row keys={["g", "d"]} label="Dashboard" />
            <Row keys={["g", "a"]} label="Activity" />
            <Row keys={["g", "c"]} label="Kampagnen" />
            <Row keys={["g", "i"]} label="Initiativen" />
            <Row keys={["g", "l"]} label="Intent-Cluster" />
            <Row keys={["g", "f"]} label="Findings" />
            <Row keys={["g", "r"]} label="Learnings" />
            <Row keys={["g", "p"]} label="Performance" />
            <Row keys={["g", "o"]} label="Outcomes" />
            <Row keys={["g", "s"]} label="Sync-Runs" />
            <Row keys={["g", "e"]} label="Einstellungen" />
          </Group>
          <Group title="Allgemein">
            <Row keys={["?"]} label="Diese Hilfe" />
            <Row keys={["Esc"]} label="Schließen" />
          </Group>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="text-[10px] font-mono px-1.5 py-0.5 min-w-[20px] text-center border border-border rounded bg-muted/50"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
