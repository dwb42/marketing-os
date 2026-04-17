"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Campaign, AssetVersion } from "@/lib/types";
import { ChevronDown, ChevronRight, ExternalLink, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Review panel: surfaces what a reviewer would actually approve. Takes the
 * latest non-draft version of each linked asset, pulls out the well-known
 * fields (headlines, descriptions, keywords, negativeKeywords, targetUrl,
 * path1, path2), and renders them in a scannable layout. Collapsed by
 * default unless the campaign is IN_REVIEW.
 */
export function CampaignReviewPanel({
  campaign,
  workspaceId,
}: {
  campaign: Campaign;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(campaign.status === "IN_REVIEW");

  const assetIds = campaign.campaignAssets?.map((ca) => ca.assetId) ?? [];
  const versionsQueries = useQueries({
    queries: assetIds.map((id) => ({
      queryKey: ["asset-versions", id, workspaceId],
      queryFn: () => api.assets.versions(id, workspaceId),
      enabled: !!workspaceId,
    })),
  });

  const loading = versionsQueries.some((q) => q.isLoading);

  // Merge all latest-non-draft versions into one logical content object.
  const merged = mergeLatestContent(
    (campaign.campaignAssets ?? []).map((ca, i) => ({
      role: ca.role,
      versions: versionsQueries[i]?.data ?? [],
    })),
  );

  const hasContent =
    merged.headlines.length > 0 ||
    merged.descriptions.length > 0 ||
    merged.keywords.length > 0 ||
    merged.negativeKeywords.length > 0 ||
    !!merged.targetUrl;

  // Hide entirely if we have no content AND the campaign is past review.
  if (!hasContent && campaign.status !== "IN_REVIEW" && campaign.status !== "APPROVED") {
    return null;
  }

  return (
    <Card
      className={cn(
        campaign.status === "IN_REVIEW" ? "border-amber-500/40 bg-amber-500/[0.02]" : "",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 h-11 border-b border-border hover:bg-muted/40 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <div className="size-6 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 grid place-items-center">
          <Eye size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Review-Preview</div>
          <div className="text-[11px] text-muted-foreground">
            {campaign.status === "IN_REVIEW"
              ? "Was der Reviewer vor dem Approven sieht"
              : "Was gesynct wird (latest non-draft versions)"}
          </div>
        </div>
        {campaign.status === "IN_REVIEW" ? (
          <StatusBadge status="IN_REVIEW" />
        ) : null}
      </button>

      {open ? (
        <CardContent className="p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !hasContent ? (
            <div className="text-sm text-muted-foreground">
              Keine reviewbaren Inhalte: die verknüpften Assets haben noch
              keine Version mit Status ≥ <span className="font-mono">IN_REVIEW</span>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {merged.headlines.length > 0 ? (
                <Section
                  title={`Headlines · ${merged.headlines.length}`}
                  hint="max 30 Zeichen je Headline"
                >
                  <ol className="space-y-1 list-decimal list-inside">
                    {merged.headlines.map((h, i) => (
                      <li key={i} className="text-sm">
                        <span className={charCountColor(h.length, 30)}>{h}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground tabular-nums">
                          {h.length}/30
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              ) : null}

              {merged.descriptions.length > 0 ? (
                <Section
                  title={`Descriptions · ${merged.descriptions.length}`}
                  hint="max 90 Zeichen je Description"
                >
                  <ol className="space-y-2 list-decimal list-inside">
                    {merged.descriptions.map((d, i) => (
                      <li key={i} className="text-sm">
                        <span className={charCountColor(d.length, 90)}>{d}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground tabular-nums">
                          {d.length}/90
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              ) : null}

              {merged.keywords.length > 0 ? (
                <Section title={`Keywords · ${merged.keywords.length}`} hint="Phrase Match">
                  <div className="flex flex-wrap gap-1.5">
                    {merged.keywords.map((k, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">
                        {k}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}

              {merged.negativeKeywords.length > 0 ? (
                <Section
                  title={`Negative Keywords · ${merged.negativeKeywords.length}`}
                  hint="Campaign-level, Broad Match"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {merged.negativeKeywords.map((k, i) => (
                      <span
                        key={i}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
                      >
                        −{k}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}

              {merged.targetUrl ? (
                <Section title="Ziel-URL" className="md:col-span-2">
                  <a
                    href={merged.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all font-mono"
                  >
                    <ExternalLink size={12} />
                    {merged.targetUrl}
                  </a>
                </Section>
              ) : null}

              {(merged.path1 || merged.path2) ? (
                <Section title="Display-Path">
                  <div className="text-sm font-mono text-muted-foreground">
                    …/{merged.path1 ?? ""}
                    {merged.path2 ? `/${merged.path2}` : ""}
                  </div>
                </Section>
              ) : null}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function Section({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        {hint ? <span className="text-[10px] text-muted-foreground/70">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function charCountColor(len: number, max: number): string {
  if (len > max) return "text-red-600 dark:text-red-400 font-medium";
  if (len > max * 0.9) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

interface Merged {
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  negativeKeywords: string[];
  targetUrl?: string;
  path1?: string;
  path2?: string;
}

function mergeLatestContent(
  assets: Array<{ role: string; versions: AssetVersion[] }>,
): Merged {
  const out: Merged = {
    headlines: [],
    descriptions: [],
    keywords: [],
    negativeKeywords: [],
  };

  for (const { versions } of assets) {
    // Prefer latest non-DRAFT, fall back to latest.
    const sorted = versions.slice().sort((a, b) => b.versionNum - a.versionNum);
    const pick = sorted.find((v) => v.status !== "DRAFT") ?? sorted[0];
    if (!pick) continue;
    const c = (pick.content ?? {}) as Record<string, unknown>;
    if (Array.isArray(c.headlines)) out.headlines.push(...(c.headlines as string[]));
    if (Array.isArray(c.descriptions)) out.descriptions.push(...(c.descriptions as string[]));
    if (Array.isArray(c.keywords)) out.keywords.push(...(c.keywords as string[]));
    if (Array.isArray(c.negativeKeywords))
      out.negativeKeywords.push(...(c.negativeKeywords as string[]));
    if (typeof c.targetUrl === "string" && !out.targetUrl) out.targetUrl = c.targetUrl;
    if (typeof c.path1 === "string" && !out.path1) out.path1 = c.path1;
    if (typeof c.path2 === "string" && !out.path2) out.path2 = c.path2;
  }

  return out;
}
