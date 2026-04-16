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
import { WorkspaceIdSchema } from "../schemas.js";
import type { ActorRole } from "../../domain/status.js";

const SyncCampaignSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: z.string().optional(),
});

export async function registerSyncTriggerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns/:id/sync", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const body = SyncCampaignSchema.parse(req.body);

    const actorRole = req.auth.role as ActorRole;
    if (!canActorSync(actorRole)) {
      throw new DomainError("FORBIDDEN", `Role '${actorRole}' cannot trigger sync`);
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: p.id, workspaceId: body.workspaceId },
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
    if (!campaign) throw new DomainError("NOT_FOUND", `Campaign ${p.id} not found`);
    if (campaign.status !== "APPROVED") {
      throw new DomainError("INVALID_STATE", `Campaign status is ${campaign.status}, must be APPROVED`);
    }

    const channelConnection = await prisma.channelConnection.findFirst({
      where: { workspaceId: body.workspaceId },
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

    const connector = getConnector("google_ads");
    const handle = await connector.authenticate({
      id: channelConnection.integrationAccount.id,
      channel: "google_ads",
      externalId: channelConnection.integrationAccount.externalId,
      credentialsEncrypted: JSON.stringify(channelConnection.integrationAccount.credentials),
    });

    const idempotencyKey = `push:campaign:${p.id}:${Date.now()}`;
    const { id: syncRunId } = await syncRunService.createOrGet({
      workspaceId: body.workspaceId,
      channel: "GOOGLE_ADS",
      type: "PUSH_CAMPAIGN",
      targetType: "CAMPAIGN",
      targetId: p.id,
      idempotencyKey,
      input: { campaignName: campaign.name },
    });
    await syncRunService.markRunning(syncRunId);

    try {
      const result = await connector.pushCampaign!({
        connection: handle,
        internalCampaignId: p.id,
        payload: {
          campaignName: campaign.name,
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
          workspaceId: body.workspaceId,
          campaignId: p.id,
          channel: "GOOGLE_ADS",
          channelConnectionId: channelConnection.id,
          externalId: result.externalIds.campaignId,
          externalName: campaign.name,
          status: "SYNCED",
          lastSyncedAt: new Date(),
        },
      });

      await campaignService.transition({
        workspaceId: body.workspaceId,
        campaignId: p.id,
        to: "SYNCED",
        actorId: body.actorId,
        reason: `Synced to Google Ads (campaign ${result.externalIds.campaignId})`,
      });

      await syncRunService.markSucceeded(syncRunId, result.externalIds);

      await changeEventService.append({
        workspaceId: body.workspaceId,
        subjectType: "CHANNEL_CAMPAIGN",
        subjectId: ccId,
        actorId: body.actorId,
        kind: "channel_campaign.synced",
        summary: `Campaign pushed to Google Ads as ${result.externalIds.campaignId}`,
        payload: result.externalIds,
      });

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
  });
}
