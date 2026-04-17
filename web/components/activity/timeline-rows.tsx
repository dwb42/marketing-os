"use client";

import { MessageSquare } from "lucide-react";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { iconForEvent } from "./event-icon";
import { formatDate } from "@/lib/format";
import type { ChangeEvent, Annotation } from "@/lib/types";

export function EventRow({
  event: e,
  showSubject = true,
}: {
  event: ChangeEvent;
  showSubject?: boolean;
}) {
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
          {showSubject ? (
            <>
              <span className="opacity-40">·</span>
              <span className="uppercase tracking-wide">{e.subjectType}</span>
              <IdChip id={e.subjectId} />
            </>
          ) : null}
          {e.actorId ? (
            <>
              <span className="opacity-40">·</span>
              <IdChip id={e.actorId} />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AnnotationRow({
  annotation: a,
  showSubject = true,
}: {
  annotation: Annotation;
  showSubject?: boolean;
}) {
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
          {showSubject ? (
            <>
              <span className="opacity-40">·</span>
              <span className="uppercase tracking-wide">{a.subjectType}</span>
              <IdChip id={a.subjectId} />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
