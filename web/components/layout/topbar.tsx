"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { useCmdk } from "@/components/cmd-k/context";
import { AttentionIndicator } from "@/components/layout/attention-indicator";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { workspaceId, setWorkspaceId, workspaces } = useSelectedWorkspace();
  const { setOpen } = useCmdk();

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Workspace</span>
            <Select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="h-8 min-w-[180px] text-xs"
            >
              {workspaces.length === 0 ? (
                <option value="">Keine Workspaces</option>
              ) : null}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 rounded-md border border-border bg-background hover:bg-muted px-2.5 text-xs text-muted-foreground transition-colors"
          title="Suche / Befehle (⌘K)"
        >
          <Search size={13} />
          <span>Suche…</span>
          <kbd className="ml-4 font-mono text-[10px] px-1 border border-border rounded">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          title="Suche"
        >
          <Search size={16} />
        </Button>

        <AttentionIndicator />

        <Button
          variant="ghost"
          size="icon"
          title="Theme umschalten"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun size={16} className="hidden dark:block" />
          <Moon size={16} className="block dark:hidden" />
        </Button>
      </div>
    </header>
  );
}
