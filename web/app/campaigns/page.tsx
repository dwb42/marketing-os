"use client";

import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { useSelectedWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { Settings as SettingsIcon } from "lucide-react";

export default function CampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { workspaceId } = useSelectedWorkspace();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const q = useQuery({
    queryKey: ["campaigns", workspaceId, statusFilter],
    queryFn: () =>
      api.campaigns.list({
        workspaceId,
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    enabled: !!workspaceId && !selectedId,
  });

  const campaigns = useMemo(
    () =>
      (q.data ?? [])
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [q.data],
  );

  if (!workspaceId) {
    return (
      <EmptyState
        icon={<SettingsIcon size={24} />}
        title="Kein Workspace ausgewählt"
        action={
          <Link href="/settings">
            <Button variant="outline" size="sm">Einstellungen</Button>
          </Link>
        }
      />
    );
  }

  if (selectedId) {
    return <CampaignDetail campaignId={selectedId} workspaceId={workspaceId} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kampagnen"
        description="Alle Kampagnen im Workspace · klick für Details."
        actions={
          <Select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              const url = new URL(window.location.href);
              if (v) url.searchParams.set("status", v);
              else url.searchParams.delete("status");
              window.history.pushState({}, "", url.toString());
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="h-8 min-w-[160px] text-xs"
          >
            <option value="">Alle Status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SYNCED">SYNCED</option>
            <option value="PAUSED">PAUSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </Select>
        }
      />

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      <CampaignTable campaigns={campaigns} loading={q.isLoading} />
    </div>
  );
}
