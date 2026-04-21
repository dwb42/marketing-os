import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../services/prisma.js";
import { campaignService } from "../../services/campaign.service.js";
import { syncRunService } from "../../services/sync-run.service.js";
import { changeEventService } from "../../services/change-event.service.js";
import { getConnector } from "../../connectors/registry.js";
import { newId } from "../../lib/ids.js";
import { DomainError } from "../../lib/errors.js";
import { canActorSync } from "../../domain/policies.js";
import { ReSyncCampaignSchema, WorkspaceIdSchema } from "../schemas.js";
import type { ActorRole } from "../../domain/status.js";

const SyncCampaignSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: z.string().optional(),
});

// Statuses from which a (re-)push to Google Ads is allowed.
// APPROVED  → first push (sync).
// SYNCED/PAUSED → re-push (re-sync). Creates a NEW ChannelCampaign + NEW
// external Google Ads campaign; the old ones stay for history.
// NOTE: in-place update of an existing Google Ads campaign (headline / keyword
// edits without campaign re-creation) requires connector update methods that
// are NOT yet implemented. Until then, re-sync always means "create a fresh
// external campaign from the current APPROVED asset versions".
const PUSHABLE_STATUSES = new Set(["APPROVED", "SYNCED", "PAUSED"]);

async function pushCampaignToGoogleAds(
  workspaceId: string,
  campaignId: string,
  actorId: string | undefined,
  mode: "sync" | "re-sync",
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: {
      campaignAssets: {
        include: {
          asset: {
            include: {
              versions: {
                where: { status: "APPROVED" },
                orderBy: { versionNum: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!campaign) throw new DomainError("NOT_FOUND", `Campaign ${campaignId} not found`);

  if (mode === "sync" && campaign.status !== "APPROVED") {
    throw new DomainError(
      "INVALID_STATE",
      `Campaign status is ${campaign.status}, must be APPROVED for first sync. Use POST /campaigns/:id/re-sync to re-push a SYNCED or PAUSED campaign.`,
    );
  }
  if (mode === "re-sync" && !PUSHABLE_STATUSES.has(campaign.status)) {
    throw new DomainError(
      "INVALID_STATE",
      `Campaign status is ${campaign.status}; re-sync requires APPROVED, SYNCED, or PAUSED`,
    );
  }

  const channelConnection = await prisma.channelConnection.findFirst({
    where: { workspaceId },
    include: { integrationAccount: true },
  });
  if (!channelConnection) {
    throw new DomainError("NOT_FOUND", "No ChannelConnection found for this workspace");
  }
  if (channelConnection.integrationAccount.channel !== "GOOGLE_ADS") {
    throw new DomainError("INVALID_STATE", "ChannelConnection is not GOOGLE_ADS");
  }

  let headlines: string[] = [];
  let descriptions: string[] = [];
  let keywords: string[] = [];
  let negativeKeywords: string[] = [];
  let targetUrl = "";

  for (const ca of campaign.campaignAssets) {
    const version = ca.asset.versions[0];
    if (!version) continue;
    const content = version.content as Record<string, unknown>;
    if (content.headlines) headlines = content.headlines as string[];
    if (content.descriptions) descriptions = content.descriptions as string[];
    if (content.keywords) keywords = content.keywords as string[];
    if (content.negativeKeywords) negativeKeywords = content.negativeKeywords as string[];
    if (content.targetUrl) targetUrl = content.targetUrl as string;
  }

  if (headlines.length === 0 || descriptions.length === 0) {
    throw new DomainError(
      "INVALID_STATE",
      "Campaign has no APPROVED asset versions with headlines+descriptions — cannot push empty content to Google Ads",
    );
  }

  // Re-sync builds a fresh external campaign — Google Ads rejects duplicate
  // campaign names within a customer, so derive an external name with a
  // differentiator (count of prior ChannelCampaigns for this Campaign, + 1).
  let externalCampaignName = campaign.name;
  if (mode === "re-sync") {
    const priorCount = await prisma.channelCampaign.count({ where: { campaignId } });
    externalCampaignName = `${campaign.name} — resync ${priorCount + 1}`;
  }

  const connector = getConnector("google_ads");
  const handle = await connector.authenticate({
    id: channelConnection.integrationAccount.id,
    channel: "google_ads",
    externalId: channelConnection.integrationAccount.externalId,
    credentialsEncrypted: JSON.stringify(channelConnection.integrationAccount.credentials),
  });

  const idempotencyKey = `push:campaign:${campaignId}:${mode}:${Date.now()}`;
  const { id: syncRunId } = await syncRunService.createOrGet({
    workspaceId,
    channel: "GOOGLE_ADS",
    type: "PUSH_CAMPAIGN",
    targetType: "CAMPAIGN",
    targetId: campaignId,
    idempotencyKey,
    input: { campaignName: campaign.name, mode },
  });
  await syncRunService.markRunning(syncRunId);

  try {
    const result = await connector.pushCampaign!({
      connection: handle,
      internalCampaignId: campaignId,
      payload: {
        campaignName: externalCampaignName,
        headlines,
        descriptions,
        targetUrl,
        keywords,
        negativeKeywords,
      },
    });

    const ccId = newId("channelCampaign");
    await prisma.channelCampaign.create({
      data: {
        id: ccId,
        workspaceId,
        campaignId,
        channel: "GOOGLE_ADS",
        channelConnectionId: channelConnection.id,
        externalId: result.externalIds.campaignId,
        externalName: externalCampaignName,
        status: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });

    // Transition internal Campaign to SYNCED:
    // - from APPROVED directly (canonical).
    // - from PAUSED via intermediate hop (allowed by policy).
    // - from SYNCED: stays SYNCED (no transition), but emit a re_synced event.
    if (campaign.status === "APPROVED") {
      await campaignService.transition({
        workspaceId,
        campaignId,
        to: "SYNCED",
        ...(actorId !== undefined ? { actorId } : {}),
        reason: `Synced to Google Ads (campaign ${result.externalIds.campaignId})`,
      });
    } else if (campaign.status === "PAUSED") {
      await campaignService.transition({
        workspaceId,
        campaignId,
        to: "SYNCED",
        ...(actorId !== undefined ? { actorId } : {}),
        reason: `Re-synced to Google Ads (campaign ${result.externalIds.campaignId})`,
      });
    }

    await syncRunService.markSucceeded(syncRunId, result.externalIds);

    await changeEventService.append({
      workspaceId,
      subjectType: "CHANNEL_CAMPAIGN",
      subjectId: ccId,
      actorId,
      kind: mode === "re-sync" ? "channel_campaign.re_synced" : "channel_campaign.synced",
      summary:
        mode === "re-sync"
          ? `Campaign re-pushed to Google Ads as ${result.externalIds.campaignId} (new external; prior ChannelCampaigns kept for history)`
          : `Campaign pushed to Google Ads as ${result.externalIds.campaignId}`,
      payload: result.externalIds,
    });

    if (mode === "re-sync") {
      await changeEventService.append({
        workspaceId,
        subjectType: "CAMPAIGN",
        subjectId: campaignId,
        actorId,
        kind: "campaign.re_synced",
        summary: `Campaign re-synced; new ChannelCampaign ${ccId}, new external ${result.externalIds.campaignId}`,
        payload: { newChannelCampaignId: ccId, externalIds: result.externalIds },
      });
    }

    return {
      ok: true,
      syncRunId,
      channelCampaignId: ccId,
      externalIds: result.externalIds,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const kind = (err as { kind?: string })?.kind ?? "UNKNOWN";
    await syncRunService.markFailed(syncRunId, kind, message);
    throw err;
  }
}

export async function registerSyncTriggerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns/:id/sync", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const body = SyncCampaignSchema.parse(req.body);

    const actorRole = req.auth.role as ActorRole;
    if (!canActorSync(actorRole)) {
      throw new DomainError("FORBIDDEN", `Role '${actorRole}' cannot trigger sync`);
    }

    return pushCampaignToGoogleAds(body.workspaceId, p.id, body.actorId, "sync");
  });

  app.post("/campaigns/:id/re-sync", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const body = ReSyncCampaignSchema.parse(req.body);

    const actorRole = req.auth.role as ActorRole;
    if (!canActorSync(actorRole)) {
      throw new DomainError("FORBIDDEN", `Role '${actorRole}' cannot trigger sync`);
    }

    return pushCampaignToGoogleAds(body.workspaceId, p.id, body.actorId, "re-sync");
  });
}
