import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
import { canTransitionCampaign } from "../domain/policies.js";
import type { CampaignStatus } from "../domain/status.js";
import { changeEventService } from "./change-event.service.js";

// Campaign statuses in which inline edits (PATCH, asset (un)link) are allowed.
// Once APPROVED, edits go through new Asset-Versions + transition, not PATCH.
const MUTABLE_STATUSES: CampaignStatus[] = ["DRAFT", "IN_REVIEW"];
// Campaigns can only be hard-deleted in these statuses. SYNCED/APPROVED etc.
// stay around for history — archive them first.
const HARD_DELETABLE_STATUSES: CampaignStatus[] = ["DRAFT", "ARCHIVED"];

export interface CreateCampaignInput {
  workspaceId: string;
  productId: string;
  name: string;
  objective: string;
  initiativeId?: string;
  audienceSegmentId?: string;
  startsAt?: Date;
  endsAt?: Date;
  actorId?: string;
}

export class CampaignService {
  async createDraft(input: CreateCampaignInput): Promise<string> {
    const id = newId("campaign");
    await prisma.campaign.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        productId: input.productId,
        name: input.name,
        objective: input.objective,
        initiativeId: input.initiativeId ?? null,
        audienceSegmentId: input.audienceSegmentId ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdByActorId: input.actorId ?? null,
        status: "DRAFT",
      },
    });

    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "CAMPAIGN",
      subjectId: id,
      actorId: input.actorId,
      kind: "campaign.created",
      summary: `Campaign "${input.name}" created as DRAFT`,
      payload: { name: input.name, productId: input.productId },
    });

    return id;
  }

  async transition(params: {
    workspaceId: string;
    campaignId: string;
    to: CampaignStatus;
    actorId?: string;
    reason?: string;
  }): Promise<void> {
    const existing = await prisma.campaign.findFirst({
      where: { id: params.campaignId, workspaceId: params.workspaceId },
      include: { campaignAssets: { include: { asset: { include: { versions: true } } } } },
    });
    if (!existing) throw notFound("Campaign", params.campaignId);

    const from = existing.status as CampaignStatus;
    if (from === params.to) return;
    if (!canTransitionCampaign(from, params.to)) {
      throw invalidState(`Illegal campaign transition ${from} → ${params.to}`, {
        campaignId: params.campaignId,
      });
    }

    if (params.to === "IN_REVIEW") {
      if (!existing.initiativeId) {
        throw invalidInput("Campaign kann nicht in IN_REVIEW übergehen: initiativeId fehlt");
      }
      if (existing.campaignAssets.length === 0) {
        throw invalidInput("Campaign kann nicht in IN_REVIEW übergehen: keine Assets verknüpft");
      }
      const hasNonDraftVersion = existing.campaignAssets.some((ca) =>
        ca.asset.versions.some((v) => v.status !== "DRAFT"),
      );
      if (!hasNonDraftVersion) {
        throw invalidInput("Campaign kann nicht in IN_REVIEW übergehen: kein Asset hat eine Version mit Status != DRAFT");
      }
    }

    await prisma.campaign.update({
      where: { id: params.campaignId },
      data: { status: params.to },
    });

    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "CAMPAIGN",
      subjectId: params.campaignId,
      actorId: params.actorId,
      kind: "campaign.transitioned",
      summary: `Campaign ${from} → ${params.to}`,
      payload: { from, to: params.to, reason: params.reason ?? null },
    });
  }

  async get(workspaceId: string, campaignId: string) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: { channelCampaigns: true, campaignAssets: true },
    });
    if (!c) throw notFound("Campaign", campaignId);
    return c;
  }

  async list(workspaceId: string, filter: { productId?: string; status?: CampaignStatus } = {}) {
    return prisma.campaign.findMany({
      where: {
        workspaceId,
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async linkAsset(params: {
    workspaceId: string;
    campaignId: string;
    assetId: string;
    role: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ linked: boolean }> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.campaignId, workspaceId: params.workspaceId },
    });
    if (!campaign) throw notFound("Campaign", params.campaignId);
    if (!MUTABLE_STATUSES.includes(campaign.status as CampaignStatus)) {
      throw invalidState(
        `Cannot link asset to campaign in status ${campaign.status}; only DRAFT or IN_REVIEW allowed`,
        { campaignId: params.campaignId, status: campaign.status },
      );
    }

    const asset = await prisma.asset.findFirst({
      where: { id: params.assetId, workspaceId: params.workspaceId },
    });
    if (!asset) throw notFound("Asset", params.assetId);

    const existing = await prisma.campaignAsset.findUnique({
      where: {
        campaignId_assetId_role: {
          campaignId: params.campaignId,
          assetId: params.assetId,
          role: params.role,
        },
      },
    });
    if (existing) return { linked: false };

    await prisma.campaignAsset.create({
      data: {
        campaignId: params.campaignId,
        assetId: params.assetId,
        role: params.role,
      },
    });

    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "CAMPAIGN",
      subjectId: params.campaignId,
      actorId: params.actorId,
      kind: "campaign_asset.linked",
      summary: `Asset ${params.assetId} linked as "${params.role}"`,
      payload: {
        assetId: params.assetId,
        role: params.role,
        reason: params.reason ?? null,
      },
    });

    return { linked: true };
  }

  async unlinkAsset(params: {
    workspaceId: string;
    campaignId: string;
    assetId: string;
    role: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ unlinked: boolean }> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.campaignId, workspaceId: params.workspaceId },
    });
    if (!campaign) throw notFound("Campaign", params.campaignId);
    if (!MUTABLE_STATUSES.includes(campaign.status as CampaignStatus)) {
      throw invalidState(
        `Cannot unlink asset from campaign in status ${campaign.status}; only DRAFT or IN_REVIEW allowed`,
        { campaignId: params.campaignId, status: campaign.status },
      );
    }

    const existing = await prisma.campaignAsset.findUnique({
      where: {
        campaignId_assetId_role: {
          campaignId: params.campaignId,
          assetId: params.assetId,
          role: params.role,
        },
      },
    });
    if (!existing) return { unlinked: false };

    await prisma.campaignAsset.delete({
      where: {
        campaignId_assetId_role: {
          campaignId: params.campaignId,
          assetId: params.assetId,
          role: params.role,
        },
      },
    });

    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "CAMPAIGN",
      subjectId: params.campaignId,
      actorId: params.actorId,
      kind: "campaign_asset.unlinked",
      summary: `Asset ${params.assetId} unlinked from role "${params.role}"`,
      payload: {
        assetId: params.assetId,
        role: params.role,
        reason: params.reason ?? null,
      },
    });

    return { unlinked: true };
  }

  async listAssets(workspaceId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) throw notFound("Campaign", campaignId);

    return prisma.campaignAsset.findMany({
      where: { campaignId },
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
      orderBy: { createdAt: "asc" },
    });
  }

  async update(params: {
    workspaceId: string;
    campaignId: string;
    patch: {
      name?: string;
      objective?: string;
      initiativeId?: string | null;
      audienceSegmentId?: string | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
    };
    actorId?: string;
    reason?: string;
  }) {
    const existing = await prisma.campaign.findFirst({
      where: { id: params.campaignId, workspaceId: params.workspaceId },
    });
    if (!existing) throw notFound("Campaign", params.campaignId);
    if (!MUTABLE_STATUSES.includes(existing.status as CampaignStatus)) {
      throw invalidState(
        `Cannot PATCH campaign in status ${existing.status}; only DRAFT or IN_REVIEW allowed`,
        { campaignId: params.campaignId, status: existing.status },
      );
    }

    const before = {
      name: existing.name,
      objective: existing.objective,
      initiativeId: existing.initiativeId,
      audienceSegmentId: existing.audienceSegmentId,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
    };

    const data: Record<string, unknown> = {};
    if (params.patch.name !== undefined) data.name = params.patch.name;
    if (params.patch.objective !== undefined) data.objective = params.patch.objective;
    if (params.patch.initiativeId !== undefined) data.initiativeId = params.patch.initiativeId;
    if (params.patch.audienceSegmentId !== undefined)
      data.audienceSegmentId = params.patch.audienceSegmentId;
    if (params.patch.startsAt !== undefined) data.startsAt = params.patch.startsAt;
    if (params.patch.endsAt !== undefined) data.endsAt = params.patch.endsAt;

    if (Object.keys(data).length === 0) {
      throw invalidInput("PATCH body must include at least one field to change");
    }

    const updated = await prisma.campaign.update({
      where: { id: params.campaignId },
      data,
    });

    const after: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      after[key] = (updated as unknown as Record<string, unknown>)[key];
    }

    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "CAMPAIGN",
      subjectId: params.campaignId,
      actorId: params.actorId,
      kind: "campaign.patched",
      summary: `Campaign patched (${Object.keys(data).join(", ")})`,
      payload: {
        before: Object.fromEntries(
          Object.keys(data).map((k) => [k, (before as Record<string, unknown>)[k]]),
        ),
        after,
        reason: params.reason ?? null,
      },
    });

    return updated;
  }

  async delete(params: {
    workspaceId: string;
    campaignId: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const existing = await prisma.campaign.findFirst({
      where: { id: params.campaignId, workspaceId: params.workspaceId },
      include: {
        channelCampaigns: {
          include: { adGroups: { include: { ads: true, keywords: true } }, negatives: true },
        },
      },
    });
    if (!existing) throw notFound("Campaign", params.campaignId);
    if (!HARD_DELETABLE_STATUSES.includes(existing.status as CampaignStatus)) {
      throw invalidState(
        `Cannot hard-delete campaign in status ${existing.status}; only DRAFT or ARCHIVED allowed`,
        { campaignId: params.campaignId, status: existing.status },
      );
    }

    // Collect polymorphic subject IDs so ChangeEvents/Annotations/Approvals/
    // SyncRuns attached to sub-entities can be pruned too. Same shape as the
    // delete-campaigns script.
    const ccIds = existing.channelCampaigns.map((cc) => cc.id);
    const agIds = existing.channelCampaigns.flatMap((cc) => cc.adGroups.map((ag) => ag.id));
    const adIds = existing.channelCampaigns.flatMap((cc) =>
      cc.adGroups.flatMap((ag) => ag.ads.map((ad) => ad.id)),
    );
    const kwIds = [
      ...existing.channelCampaigns.flatMap((cc) =>
        cc.adGroups.flatMap((ag) => ag.keywords.map((k) => k.id)),
      ),
      ...existing.channelCampaigns.flatMap((cc) => cc.negatives.map((n) => n.id)),
    ];

    const pairs: Array<{ type: string; ids: string[] }> = [
      { type: "CAMPAIGN", ids: [params.campaignId] },
      { type: "CHANNEL_CAMPAIGN", ids: ccIds },
      { type: "CHANNEL_AD_GROUP", ids: agIds },
      { type: "CHANNEL_AD", ids: adIds },
      { type: "CHANNEL_KEYWORD", ids: kwIds },
    ].filter((p) => p.ids.length > 0);

    const orSubject = pairs.map((p) => ({ subjectType: p.type, subjectId: { in: p.ids } }));
    const orTarget = pairs.map((p) => ({ targetType: p.type, targetId: { in: p.ids } }));

    // Emit the corrects event BEFORE the delete so correctsId is defined and
    // the audit trail survives the cascade.
    const correctsId = newId("changeEvent");
    await prisma.$transaction(async (tx) => {
      await tx.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "CAMPAIGN",
          subjectId: params.campaignId,
          actorId: params.actorId ?? null,
          kind: "campaign.deleted",
          summary: `Campaign "${existing.name}" hard-deleted (was ${existing.status})`,
          payload: {
            name: existing.name,
            status: existing.status,
            reason: params.reason ?? null,
            purged: {
              channelCampaigns: ccIds.length,
              adGroups: agIds.length,
              ads: adIds.length,
              keywords: kwIds.length,
            },
          },
        },
      });

      await tx.annotation.deleteMany({ where: { OR: orSubject } });
      await tx.approval.deleteMany({ where: { OR: orTarget } });
      await tx.syncRun.deleteMany({ where: { OR: orTarget } });
      // Delete ChangeEvents *except* the corrects event we just created.
      await tx.changeEvent.deleteMany({
        where: { AND: [{ OR: orSubject }, { id: { not: correctsId } }] },
      });
      await tx.campaign.delete({ where: { id: params.campaignId } });
    });

    return { deleted: true, correctsId };
  }
}

export const campaignService = new CampaignService();
