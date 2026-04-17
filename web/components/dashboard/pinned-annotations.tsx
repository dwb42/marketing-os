"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/format";

/**
 * Horizontal strip of pinned annotations across the workspace. Renders
 * nothing when there are no pinned items — zero visual weight by default.
 */
export function PinnedAnnotations({ workspaceId }: { workspaceId: string }) {
  const q = useQuery({
    queryKey: ["annotations-pinned", workspaceId],
    queryFn: () => api.annotations.listWorkspace({ workspaceId, pinned: true }),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const pinned = q.data ?? [];
  if (pinned.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3">
      <div className="shrink-0 size-6 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 grid place-items-center mt-0.5">
        <MessageSquare size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
          Gepinnt · {pinned.length}
        </div>
        <ul className="flex flex-col gap-1.5">
          {pinned.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 pt-0.5">
                {formatDate(a.occurredAt)}
              </span>
              <span className="flex-1 line-clamp-1">{a.body}</span>
              <Link
                href={linkForSubject(a.subjectType, a.subjectId)}
                className="text-[11px] text-muted-foreground hover:text-foreground font-mono shrink-0"
              >
                {a.subjectType.toLowerCase()} →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function linkForSubject(subjectType: string, subjectId: string): string {
  const t = subjectType.toUpperCase();
  if (t === "CAMPAIGN") return `/campaigns?id=${subjectId}`;
  if (t === "INITIATIVE") return `/initiatives?id=${subjectId}`;
  if (t === "CLUSTER" || t === "INTENT_CLUSTER") return `/clusters?id=${subjectId}`;
  return "/activity";
}
