"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { OutcomeFunnelWidget } from "@/components/dashboard/outcome-funnel";
import { RelativeTime } from "@/components/common/relative-time";
import { useSelectedWorkspace, useSelectedProduct } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { daysAgo, todayEnd, isoDate } from "@/lib/format";
import { TrendingUp, Settings as SettingsIcon } from "lucide-react";
import { ExportCsvButton } from "@/components/common/export-button";

export default function OutcomesPage() {
  const { workspaceId } = useSelectedWorkspace();
  const { productId, product, products, setProductId } = useSelectedProduct(workspaceId);
  const [days, setDays] = useState(14);
  const [typeFilter, setTypeFilter] = useState("");

  const from = isoDate(daysAgo(days));
  const to = isoDate(todayEnd());

  const funnelQ = useQuery({
    queryKey: ["funnel", productId, from, to],
    queryFn: () => api.outcomes.funnel({ productId, from, to }),
    enabled: !!productId,
  });

  const eventsQ = useQuery({
    queryKey: ["outcomes", productId, from, to, typeFilter],
    queryFn: () =>
      api.outcomes.query({
        productId,
        from,
        to,
        ...(typeFilter ? { type: typeFilter } : {}),
      }),
    enabled: !!productId,
  });

  const events = useMemo(
    () => (eventsQ.data ?? []).slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [eventsQ.data],
  );

  if (!productId) {
    return (
      <div className="max-w-xl">
        <PageHeader title="Outcomes" />
        <EmptyState
          icon={<SettingsIcon size={24} />}
          title="Kein Product ausgewählt"
          description={
            products.length === 0
              ? "Es wurden keine Products gefunden. Lege eines im Backend an."
              : "Wähle ein Product aus der Liste."
          }
          action={
            products.length > 0 ? (
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="min-w-[240px]"
              >
                <option value="">— auswählen —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Link href="/settings">
                <Button variant="outline" size="sm">Einstellungen</Button>
              </Link>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outcomes"
        description={product ? `${product.name} · letzte ${days} Tage` : ""}
        actions={
          <div className="flex items-center gap-2">
            {products.length > 1 ? (
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="h-8 min-w-[180px] text-xs"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            ) : null}
            <Select
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-8 min-w-[120px] text-xs"
            >
              <option value="3">3 Tage</option>
              <option value="7">7 Tage</option>
              <option value="14">14 Tage</option>
              <option value="30">30 Tage</option>
              <option value="90">90 Tage</option>
            </Select>
            <ExportCsvButton
              rows={events}
              filenamePrefix="outcomes"
              columns={[
                { header: "OccurredAt", value: (r) => r.occurredAt },
                { header: "Type", value: (r) => r.type },
                { header: "SessionRef", value: (r) => r.sessionRef ?? "" },
                { header: "UtmSource", value: (r) => (r.attribution as Record<string, string>)?.utm_source ?? "" },
                { header: "UtmMedium", value: (r) => (r.attribution as Record<string, string>)?.utm_medium ?? "" },
                { header: "UtmCampaign", value: (r) => (r.attribution as Record<string, string>)?.utm_campaign ?? "" },
                { header: "Attribution", value: (r) => JSON.stringify(r.attribution ?? {}) },
                { header: "Payload", value: (r) => JSON.stringify(r.payload ?? {}) },
              ]}
            />
          </div>
        }
      />

      {funnelQ.isError ? <ErrorState error={funnelQ.error} onRetry={() => funnelQ.refetch()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutcomeFunnelWidget
          funnel={funnelQ.data?.funnel}
          loading={funnelQ.isLoading}
          productSelected={true}
        />

        <Card>
          <CardHeader>
            <CardTitle>Event-Typen</CardTitle>
            <CardDescription>Filter für die Event-Liste unten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => setTypeFilter("")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
                typeFilter === "" ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Alle</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {funnelQ.data?.funnel.reduce((a, b) => a + b.count, 0) ?? 0}
                </span>
              </div>
            </button>
            {(funnelQ.data?.funnel ?? []).map((row) => (
              <button
                key={row.type}
                onClick={() => setTypeFilter(row.type)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
                  typeFilter === row.type
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.type}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {row.count}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                {typeFilter ? `Filter: ${typeFilter}` : "Alle Typen"} · {events.length} im Zeitraum
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {eventsQ.isLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<TrendingUp size={24} />}
                title="Keine Events im Zeitraum"
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left font-medium px-5 py-2">Typ</th>
                  <th className="text-left font-medium px-2 py-2">Session</th>
                  <th className="text-left font-medium px-2 py-2">Attribution</th>
                  <th className="text-right font-medium px-5 py-2">Wann</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 200).map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-2.5 font-medium">{e.type}</td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {e.sessionRef ?? "—"}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-muted-foreground font-mono max-w-[360px]">
                      <div className="line-clamp-1">{formatAttribution(e.attribution)}</div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <RelativeTime date={e.occurredAt} className="text-xs text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatAttribution(attr: Record<string, unknown>): string {
  if (!attr || typeof attr !== "object") return "";
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const parts: string[] = [];
  for (const k of keys) {
    const v = attr[k];
    if (typeof v === "string" && v) parts.push(`${k.replace("utm_", "")}=${v}`);
  }
  return parts.join(" · ");
}
