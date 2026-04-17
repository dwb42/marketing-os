"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { iconForEvent } from "@/components/activity/event-icon";
import { MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { ChangeEvent, Annotation } from "@/lib/types";

type TimelineNode =
  | { kind: "event"; at: string; event: ChangeEvent }
  | { kind: "annotation"; at: string; annotation: Annotation };

/**
 * Merged chronological timeline combining ChangeEvents and Annotations.
 * Annotations render as distinct amber cards with a pinned variant; events
 * render with their kind-specific icon/color. Day headers group entries.
 */
export function InitiativeTimeline({
  events,
  annotations,
}: {
  events: ChangeEvent[];
  annotations: Annotation[];
}) {
  const nodes = useMemo(() => {
    const xs: TimelineNode[] = [];
    for (const e of events) xs.push({ kind: "event", at: e.at, event: e });
    for (const a of annotations)
      xs.push({ kind: "annotation", at: a.occurredAt, annotation: a });
    xs.sort((x, y) => y.at.localeCompare(x.at));
    return xs;
  }, [events, annotations]);

  const grouped = useMemo(() => {
    const g: Record<string, TimelineNode[]> = {};
    for (const n of nodes) {
      const key = n.at.slice(0, 10);
      (g[key] ??= []).push(n);
    }
    return Object.entries(g);
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Noch keine Events oder Annotations.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([day, items]) => (
        <section key={day}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {format(parseISO(day), "EEEE, dd. MMMM yyyy", { locale: de })}
            <span className="ml-2 opacity-70 normal-case font-normal">
              {items.length} Einträge
            </span>
          </div>
          <Card>
            <ul className="divide-y divide-border">
              {items.map((n) =>
                n.kind === "event" ? (
                  <EventRow key={n.event.id} event={n.event} />
                ) : (
                  <AnnotationRow key={n.annotation.id} annotation={n.annotation} />
                ),
              )}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function EventRow({ event: e }: { event: ChangeEvent }) {
  const { icon: Icon, tone } = iconForEvent(e.kind);
  return (
    <li className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
      <div className={`mt-0.5 size-6 shrink-0 grid place-items-center rounded-md ${tone}`}>
        <Icon size={12} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{e.summary}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
          <RelativeTime date={e.at} />
          <span className="opacity-40">·</span>
          <span className="font-mono">{e.kind}</span>
          <span className="opacity-40">·</span>
          <span className="uppercase tracking-wide">{e.subjectType}</span>
          <IdChip id={e.subjectId} />
        </div>
      </div>
    </li>
  );
}

function AnnotationRow({ annotation: a }: { annotation: Annotation }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3 bg-amber-500/5 hover:bg-amber-500/10 transition-colors border-l-2 border-amber-500/50">
      <div className="mt-0.5 size-6 shrink-0 grid place-items-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <MessageSquare size={12} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm whitespace-pre-wrap">{a.body}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider">
            Annotation
          </span>
          <span className="opacity-40">·</span>
          <span>{formatDate(a.occurredAt)}</span>
          {a.pinned ? (
            <>
              <span className="opacity-40">·</span>
              <span>📌 gepinnt</span>
            </>
          ) : null}
          <span className="opacity-40">·</span>
          <span className="uppercase tracking-wide">{a.subjectType}</span>
          <IdChip id={a.subjectId} />
        </div>
      </div>
    </li>
  );
}
