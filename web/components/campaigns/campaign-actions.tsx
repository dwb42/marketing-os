"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useCampaignTransition,
  useSyncCampaign,
  useRecordApproval,
} from "@/hooks/use-mutations";
import type { Campaign, CampaignStatus } from "@/lib/types";
import {
  ChevronRight,
  Send,
  Play,
  Pause,
  Archive,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react";

/**
 * Campaign lifecycle (from docs/domain/campaign-lifecycle.md):
 *   DRAFT → IN_REVIEW → APPROVED → SYNCED → PAUSED → ARCHIVED
 *   APPROVED → DRAFT   (revoke)
 *   PAUSED → SYNCED    (resume)
 *
 * The UI surfaces the "forward" transition as a primary button, plus the
 * sync trigger (separate endpoint, real Google Ads call) when APPROVED.
 */

const NEXT_STATE: Partial<Record<CampaignStatus, CampaignStatus>> = {
  DRAFT: "IN_REVIEW",
  IN_REVIEW: "APPROVED",
  SYNCED: "PAUSED",
  PAUSED: "SYNCED",
  // APPROVED is special — see below: it gets the Sync action instead.
  // ARCHIVED is terminal.
};

export function CampaignActions({
  campaign,
  workspaceId,
}: {
  campaign: Campaign;
  workspaceId: string;
}) {
  const transition = useCampaignTransition(workspaceId);
  const sync = useSyncCampaign(workspaceId);
  const approval = useRecordApproval(workspaceId);

  const [open, setOpen] = useState<null | "next" | "sync" | "archive" | "reject" | "revoke">(null);

  const status = campaign.status;
  const next = NEXT_STATE[status];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {status === "IN_REVIEW" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen("reject")}
          >
            <XCircle size={13} /> Ablehnen
          </Button>
        ) : null}

        {status === "APPROVED" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen("revoke")}
          >
            ← Zurück auf DRAFT
          </Button>
        ) : null}

        {status === "APPROVED" ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpen("sync")}
          >
            <Upload size={13} /> Zu Google Ads syncen
          </Button>
        ) : next ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpen("next")}
          >
            {iconForTransition(status, next)}
            {labelForTransition(status, next)}
            <ChevronRight size={13} />
          </Button>
        ) : null}

        {status !== "ARCHIVED" && status !== "DRAFT" && status !== "IN_REVIEW" && status !== "APPROVED" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen("archive")}
            className="text-muted-foreground"
          >
            <Archive size={13} /> Archivieren
          </Button>
        ) : null}
      </div>

      {/* Forward transition (handles the Draft→Review, Review→Approved, Synced↔Paused cases) */}
      <ConfirmDialog
        open={open === "next"}
        onOpenChange={(v) => !v && setOpen(null)}
        title={next ? `Status: ${status} → ${next}` : "Transition"}
        description={
          <span>
            Campaign <span className="font-mono">{campaign.name}</span> wird auf{" "}
            <span className="font-mono font-medium">{next}</span> gesetzt.
            {status === "IN_REVIEW" && next === "APPROVED"
              ? " Damit ist sie sync-bereit."
              : null}
          </span>
        }
        confirmLabel="Transitioniere"
        onConfirm={async () => {
          if (!next) return;
          await transition.mutateAsync({ campaignId: campaign.id, to: next });
          // Also record an approval event for the review → approved step.
          if (status === "IN_REVIEW" && next === "APPROVED") {
            await approval.mutateAsync({
              targetType: "CAMPAIGN",
              targetId: campaign.id,
              decision: "APPROVED",
            });
          }
        }}
      />

      {/* Sync trigger — real Google Ads push, require typing confirm */}
      <ConfirmDialog
        open={open === "sync"}
        onOpenChange={(v) => !v && setOpen(null)}
        variant="danger"
        title="Zu Google Ads pushen"
        description={
          <div className="space-y-2">
            <div>
              Erstellt die Kampagne inkl. Budget, Ad-Group, Keywords und
              Negative-Keywords auf Google Ads.
            </div>
            <div className="text-xs">
              Status wird auf <span className="font-mono">SYNCED</span> gesetzt.
              Die Kampagne wird auf Google Ads als{" "}
              <span className="font-mono">PAUSED</span> angelegt — Aktivierung
              ist ein separater Schritt im Google-Ads-UI.
            </div>
          </div>
        }
        requireTyping="SYNC"
        confirmLabel="Jetzt syncen"
        onConfirm={async () => {
          await sync.mutateAsync({ campaignId: campaign.id });
        }}
      />

      {/* Reject from IN_REVIEW → DRAFT via approval + transition */}
      <ConfirmDialog
        open={open === "reject"}
        onOpenChange={(v) => !v && setOpen(null)}
        variant="danger"
        title="Review ablehnen"
        description="Setzt die Kampagne zurück auf DRAFT und erfasst eine REJECTED-Approval."
        confirmLabel="Ablehnen"
        onConfirm={async () => {
          await approval.mutateAsync({
            targetType: "CAMPAIGN",
            targetId: campaign.id,
            decision: "REJECTED",
          });
          await transition.mutateAsync({ campaignId: campaign.id, to: "DRAFT", reason: "rejected in review" });
        }}
      />

      {/* APPROVED → DRAFT (revoke before sync) */}
      <ConfirmDialog
        open={open === "revoke"}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Auf DRAFT zurücksetzen"
        description="Die Kampagne wird wieder editierbar. Bestehende Approval bleibt im Changelog."
        confirmLabel="Zurücksetzen"
        onConfirm={async () => {
          await transition.mutateAsync({ campaignId: campaign.id, to: "DRAFT", reason: "revoked approval" });
        }}
      />

      {/* Archive */}
      <ConfirmDialog
        open={open === "archive"}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Archivieren"
        description="Archivierte Kampagnen werden nicht mehr aktualisiert. Die Historie bleibt."
        confirmLabel="Archivieren"
        onConfirm={async () => {
          await transition.mutateAsync({ campaignId: campaign.id, to: "ARCHIVED" });
        }}
      />
    </>
  );
}

function labelForTransition(from: CampaignStatus, to: CampaignStatus): string {
  if (from === "DRAFT" && to === "IN_REVIEW") return "In Review geben";
  if (from === "IN_REVIEW" && to === "APPROVED") return "Approven";
  if (from === "SYNCED" && to === "PAUSED") return "Pausieren";
  if (from === "PAUSED" && to === "SYNCED") return "Wieder aktivieren";
  return `${from} → ${to}`;
}

function iconForTransition(from: CampaignStatus, to: CampaignStatus): React.ReactNode {
  if (to === "IN_REVIEW") return <Send size={13} />;
  if (to === "APPROVED") return <CheckCircle2 size={13} />;
  if (to === "PAUSED") return <Pause size={13} />;
  if (to === "SYNCED") return <Play size={13} />;
  return null;
}
