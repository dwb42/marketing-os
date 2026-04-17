"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Activity,
  Megaphone,
  Target,
  Layers,
  Lightbulb,
  BookOpen,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Flag,
  FileDiff,
  CornerDownLeft,
} from "lucide-react";
import { useCmdk } from "./context";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SearchResponse } from "@/lib/types";

interface Item {
  id: string;
  label: string;
  hint?: string;
  section: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: Item[] = [
  { id: "nav-dashboard", label: "Dashboard", section: "Navigation", href: "/", icon: LayoutDashboard },
  { id: "nav-activity", label: "Activity", section: "Navigation", href: "/activity", icon: Activity },
  { id: "nav-campaigns", label: "Kampagnen", section: "Navigation", href: "/campaigns", icon: Megaphone },
  { id: "nav-initiatives", label: "Initiativen", section: "Navigation", href: "/initiatives", icon: Target },
  { id: "nav-clusters", label: "Intent-Cluster", section: "Navigation", href: "/clusters", icon: Layers },
  { id: "nav-findings", label: "Findings", section: "Navigation", href: "/findings", icon: Lightbulb },
  { id: "nav-learnings", label: "Learnings", section: "Navigation", href: "/learnings", icon: BookOpen },
  { id: "nav-performance", label: "Performance", section: "Navigation", href: "/performance", icon: BarChart3 },
  { id: "nav-outcomes", label: "Outcomes", section: "Navigation", href: "/outcomes", icon: TrendingUp },
  { id: "nav-sync-runs", label: "Sync-Runs", section: "Navigation", href: "/sync-runs", icon: RefreshCw },
  { id: "nav-settings", label: "Einstellungen", section: "Navigation", href: "/settings", icon: SettingsIcon },
];

function useDebounced<T>(value: T, delay = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function CommandPalette() {
  const { open, setOpen } = useCmdk();
  const { workspaceId } = useSelectedWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debouncedQuery = useDebounced(query, 180);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after paint
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const searchQ = useQuery<SearchResponse>({
    queryKey: ["cmdk-search", workspaceId, debouncedQuery],
    queryFn: () => api.search({ workspaceId, q: debouncedQuery }),
    enabled: open && !!workspaceId && debouncedQuery.length >= 2,
    staleTime: 15_000,
  });

  // Build the flat ordered list of items based on current state
  const items: Item[] = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length < 2) {
      return NAV_ITEMS;
    }

    const navMatches = NAV_ITEMS.filter((n) =>
      n.label.toLowerCase().includes(needle),
    );

    const out: Item[] = [...navMatches];
    const r = searchQ.data;
    if (r) {
      for (const c of r.campaigns.slice(0, 6)) {
        out.push({
          id: `cmp-${c.id}`,
          label: c.name,
          hint: c.status,
          section: "Kampagnen",
          href: `/campaigns?id=${c.id}`,
          icon: Megaphone,
        });
      }
      for (const c of r.clusters.slice(0, 6)) {
        out.push({
          id: `clu-${c.id}`,
          label: c.name,
          hint: c.validation,
          section: "Cluster",
          href: `/clusters?id=${c.id}`,
          icon: Layers,
        });
      }
      for (const f of r.findings.slice(0, 6)) {
        out.push({
          id: `fnd-${f.id}`,
          label: f.beobachtung,
          hint: f.konfidenz,
          section: "Findings",
          href: `/findings`,
          icon: Flag,
        });
      }
      for (const a of r.assets.slice(0, 6)) {
        out.push({
          id: `ast-${a.id}`,
          label: a.name,
          hint: a.kind,
          section: "Assets",
          href: `/campaigns`,
          icon: FileDiff,
        });
      }
      for (const l of r.learnings.slice(0, 4)) {
        out.push({
          id: `lrn-${l.id}`,
          label: l.statement,
          hint: l.confidence,
          section: "Learnings",
          href: "/learnings",
          icon: BookOpen,
        });
      }
    }

    return out;
  }, [query, searchQ.data]);

  // Clamp active index when items change
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items]);

  const activate = useCallback(
    (idx: number) => {
      const it = items[idx];
      if (!it) return;
      setOpen(false);
      router.push(it.href);
    },
    [items, router, setOpen],
  );

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(active);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  // Group items by section in rendering, preserving flat index for keyboard nav.
  const groups: Array<{ section: string; items: Array<{ item: Item; index: number }> }> = [];
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    let gi = seen.get(item.section);
    if (gi === undefined) {
      gi = groups.length;
      seen.set(item.section, gi);
      groups.push({ section: item.section, items: [] });
    }
    groups[gi].items.push({ item, index });
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4 bg-background/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <SearchIcon size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder={
              workspaceId
                ? "Springe zu… oder suche Campaign, Cluster, Finding, Asset…"
                : "Erst Workspace in Settings auswählen"
            }
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {debouncedQuery.length >= 2 && searchQ.isLoading
                ? "Suche…"
                : "Keine Treffer."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.section} className="px-2">
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {g.section}
                </div>
                {g.items.map(({ item, index }) => {
                  const Icon = item.icon;
                  const isActive = index === active;
                  return (
                    <button
                      key={item.id}
                      data-idx={index}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => activate(index)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon size={14} className="shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                          {item.hint}
                        </span>
                      ) : null}
                      {isActive ? (
                        <CornerDownLeft size={12} className="text-muted-foreground" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="h-8 px-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono px-1 border border-border rounded">↑</kbd>
              <kbd className="font-mono px-1 border border-border rounded">↓</kbd>
              <span>Nav</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono px-1 border border-border rounded">↵</kbd>
              <span>Öffnen</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 border border-border rounded">⌘K</kbd>
            <span>Palette</span>
          </span>
        </div>
      </div>
    </div>
  );
}
