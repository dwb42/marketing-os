"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { RelativeTime } from "@/components/common/relative-time";
import { IdChip } from "@/components/common/id-chip";
import { iconForEvent } from "@/components/activity/event-icon";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { daysAgo, todayEnd, isoDate, formatDate } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Activity as ActivityIcon } from "lucide-react";

export default function ActivityPage() {
  const { workspaceId } = useSelectedWorkspace();
  const [days, setDays] = useState(14);
  const [subjectType, setSubjectType] = useState<string>("");
  const [actorId, setActorFilter] = useState<string>("");
  const [kind, setKindFilter] = useState<string>("");

  const from = isoDate(daysAgo(days));
  const to = isoDate(todayEnd());

  const q = useQuery({
    queryKey: ["changelog", workspaceId, from, to],
    queryFn: () => api.changelog.query({ workspaceId, from, to }),
    enabled: !!workspaceId,
  });

  const events = useMemo(() => {
    const raw = q.data ?? [];
    const filtered = raw.filter((e) => {
      if (subjectType && e.subjectType !== subjectType) return false;
      if (actorId && e.actorId !== actorId) return false;
      if (kind && e.kind !== kind) return false;
      return true;
    });
    return filtered.slice().sort((a, b) => b.at.localeCompare(a.at));
  }, [q.data, subjectType, actorId, kind]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof events> = {};
    for (const e of events) {
      const key = e.at.slice(0, 10);
      (g[key] ??= []).push(e);
    }
    return Object.entries(g);
  }, [events]);

  const subjectTypes = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((e) => s.add(e.subjectType));
    return Array.from(s).sort();
  }, [q.data]);

  const actors = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((e) => e.actorId && s.add(e.actorId));
    return Array.from(s).sort();
  }, [q.data]);

  const kinds = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((e) => s.add(e.kind));
    return Array.from(s).sort();
  }, [q.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Alle ChangeEvents im Workspace, gruppiert nach Tag."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-8 min-w-[110px] text-xs"
            >
              <option value="3">3 Tage</option>
              <option value="7">7 Tage</option>
              <option value="14">14 Tage</option>
              <option value="30">30 Tage</option>
              <option value="90">90 Tage</option>
            </Select>
            <Select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
              className="h-8 min-w-[150px] text-xs"
            >
              <option value="">Alle Subject-Typen</option>
              {subjectTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Select
              value={actorId}
              onChange={(e) => setActorFilter(e.target.value)}
              className="h-8 min-w-[150px] text-xs font-mono"
            >
              <option value="">Alle Actors</option>
              {actors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <Select
              value={kind}
              onChange={(e) => setKindFilter(e.target.value)}
              className="h-8 min-w-[180px] text-xs font-mono"
            >
              <option value="">Alle Kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </div>
        }
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {q.isLoading ? (
        <Card>
          <CardContent className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon size={24} />}
          title="Keine Aktivität im Zeitraum"
          description="Passe den Zeitraum oder Filter an."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayEvents]) => (
            <section key={date}>
              <div className="sticky top-14 z-10 bg-background/90 backdrop-blur px-1 py-1.5 mb-2 border-b border-border">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {format(parseISO(date), "EEEE, dd. MMMM yyyy", { locale: de })}
                  <span className="ml-2 text-muted-foreground/70 font-normal normal-case">
                    {dayEvents.length} Ereignisse
                  </span>
                </h2>
              </div>
              <Card>
                <ul className="divide-y divide-border">
                  {dayEvents.map((e) => {
                    const { icon: Icon, tone } = iconForEvent(e.kind);
                    const payloadPreview = previewPayload(e.payload);
                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className={`mt-0.5 size-7 shrink-0 grid place-items-center rounded-md ${tone}`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2 justify-between">
                            <div className="text-sm text-foreground">
                              {e.summary}
                            </div>
                            <RelativeTime
                              date={e.at}
                              className="text-[11px] text-muted-foreground shrink-0"
                            />
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                            <span className="font-mono">{e.kind}</span>
                            <span className="opacity-40">·</span>
                            <span className="uppercase tracking-wide">{e.subjectType}</span>
                            <IdChip id={e.subjectId} />
                            {e.actorId ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span>actor</span>
                                <IdChip id={e.actorId} />
                              </>
                            ) : null}
                          </div>
                          {payloadPreview ? (
                            <div className="text-[11px] font-mono text-muted-foreground mt-1 line-clamp-1">
                              {payloadPreview}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function previewPayload(p: unknown): string {
  if (!p || typeof p !== "object") return "";
  const entries = Object.entries(p as Record<string, unknown>);
  if (entries.length === 0) return "";
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}
