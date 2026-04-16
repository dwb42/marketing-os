import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
import { canTransitionCampaign } from "../domain/policies.js";
import type { CampaignStatus } from "../domain/status.js";
import { changeEventService } from "./change-event.service.js";

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
}

export const campaignService = new CampaignService();
