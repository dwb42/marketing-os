"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { EventRow, AnnotationRow } from "@/components/activity/timeline-rows";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { ChangeEvent, Annotation } from "@/lib/types";

type TimelineNode =
  | { kind: "event"; at: string; event: ChangeEvent }
  | { kind: "annotation"; at: string; annotation: Annotation };

/**
 * Merged chronological timeline combining ChangeEvents and Annotations.
 * Day-grouped; reverse-chronological within day.
 */
export function InitiativeTimeline({
  events,
  annotations,
}: {
  events: ChangeEvent[];
  annotations: Annotation[];
}) {
  const grouped = useMemo(() => {
    const xs: TimelineNode[] = [];
    for (const e of events) xs.push({ kind: "event", at: e.at, event: e });
    for (const a of annotations)
      xs.push({ kind: "annotation", at: a.occurredAt, annotation: a });
    xs.sort((x, y) => y.at.localeCompare(x.at));
    const g: Record<string, TimelineNode[]> = {};
    for (const n of xs) {
      const key = n.at.slice(0, 10);
      (g[key] ??= []).push(n);
    }
    return Object.entries(g);
  }, [events, annotations]);

  if (grouped.length === 0) {
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
