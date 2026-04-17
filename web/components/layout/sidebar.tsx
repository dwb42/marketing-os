"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav: Array<{
  group: string;
  items: Array<{ href: string; label: string; icon: React.ElementType }>;
}> = [
  {
    group: "Übersicht",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    group: "Strategie",
    items: [
      { href: "/initiatives", label: "Initiativen", icon: Target },
      { href: "/clusters", label: "Intent-Cluster", icon: Layers },
      { href: "/findings", label: "Findings", icon: Lightbulb },
      { href: "/learnings", label: "Learnings", icon: BookOpen },
    ],
  },
  {
    group: "Execution",
    items: [
      { href: "/campaigns", label: "Kampagnen", icon: Megaphone },
      { href: "/performance", label: "Performance", icon: BarChart3 },
      { href: "/outcomes", label: "Outcomes", icon: TrendingUp },
      { href: "/sync-runs", label: "Sync-Runs", icon: RefreshCw },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card h-screen sticky top-0">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="size-6 rounded-md bg-primary/10 border border-primary/30 grid place-items-center">
          <span className="text-[10px] font-bold text-primary">MOS</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Marketing OS</span>
          <span className="text-[10px] text-muted-foreground">Cockpit</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {nav.map((group) => (
          <div key={group.group}>
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.group}
            </div>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive(href)
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
            isActive("/settings")
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings size={15} />
          <span>Einstellungen</span>
        </Link>
      </div>
    </aside>
  );
}
