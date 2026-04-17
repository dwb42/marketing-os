"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { OutcomeFunnelWidget } from "@/components/dashboard/outcome-funnel";
import { ActiveCampaignsWidget } from "@/components/dashboard/active-campaigns";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed";
import { AttentionInboxWidget } from "@/components/dashboard/attention-inbox";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { useSelectedWorkspace, useSelectedProduct } from "@/hooks/use-workspace";
import {
  useDashboardData,
  useOutcomeFunnel,
  useRecentChangelog,
  useOpenFindings,
  useFailedSyncs,
  usePendingApprovals,
} from "@/hooks/use-dashboard";
import { Settings as SettingsIcon } from "lucide-react";

export default function DashboardPage() {
  const { workspaceId, workspace, workspaces } = useSelectedWorkspace();
  const { productId } = useSelectedProduct(workspaceId);

  const dash = useDashboardData(workspaceId, productId, 14);
  const funnelQ = useOutcomeFunnel(productId, 14);
  const changelogQ = useRecentChangelog(workspaceId, 14);
  const findingsQ = useOpenFindings(workspaceId);
  const syncsQ = useFailedSyncs(workspaceId);
  const approvalsQ = usePendingApprovals(workspaceId);

  if (!workspaceId) {
    return (
      <div className="max-w-xl">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<SettingsIcon size={24} />}
          title={workspaces.length === 0 ? "Keine Workspaces gefunden" : "Kein Workspace ausgewählt"}
          description={
            workspaces.length === 0
              ? "Prüfe API-Verbindung und Token in den Einstellungen."
              : "Wähle oben im Topbar oder in den Einstellungen einen Workspace aus."
          }
          action={
            <Link href="/settings">
              <Button variant="outline" size="sm">Einstellungen öffnen</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const chatStarts =
    funnelQ.data?.funnel.find((f) => f.type === "chat_started")?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={workspace ? `${workspace.name} · letzte 14 Tage` : "Letzte 14 Tage"}
      />

      {dash.isError && !dash.isLoading ? (
        <ErrorState error={dash.error} />
      ) : null}

      <KpiStrip
        totals={dash.totals}
        series={dash.series}
        funnelChatStarts={chatStarts}
        loading={dash.isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutcomeFunnelWidget
          funnel={funnelQ.data?.funnel}
          loading={funnelQ.isLoading}
          productSelected={!!productId}
        />
        <ActiveCampaignsWidget
          rows={dash.ccpTotals}
          loading={dash.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeedWidget
          events={changelogQ.data?.slice().sort((a, b) => b.at.localeCompare(a.at))}
          loading={changelogQ.isLoading}
        />
        <AttentionInboxWidget
          failedSyncs={syncsQ.data}
          openFindings={findingsQ.data}
          pendingApprovals={approvalsQ.data}
          loading={syncsQ.isLoading || findingsQ.isLoading || approvalsQ.isLoading}
        />
      </div>
    </div>
  );
}
