"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useSelectedWorkspace } from "@/hooks/use-workspace";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { workspaceId, setWorkspaceId, workspaces } = useSelectedWorkspace();

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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Suche (cmd+k)"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/admin/search/";
              }
            }}
          >
            <Search size={16} />
          </Button>
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
      </div>
    </header>
  );
}
