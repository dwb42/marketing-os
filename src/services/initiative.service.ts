import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";
import type { InitiativeStatus } from "../domain/status.js";

export class InitiativeService {
  async propose(input: {
    workspaceId: string;
    title: string;
    goal: string;
    actorId?: string;
    startsAt?: Date;
    endsAt?: Date;
    modules?: string[];
    outcomeLadder?: string[];
    hypothesis?: string;
    learnQuestions?: string[];
    assumptions?: string[];
    risks?: string[];
    successCriteria?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = newId("initiative");
    await prisma.initiative.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        title: input.title,
        goal: input.goal,
        status: "PROPOSED",
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        modules: input.modules ?? [],
        outcomeLadder: (input.outcomeLadder ?? []) as object,
        hypothesis: input.hypothesis ?? null,
        learnQuestions: (input.learnQuestions ?? []) as object,
        assumptions: (input.assumptions ?? []) as object,
        risks: (input.risks ?? []) as object,
        successCriteria: input.successCriteria ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "INITIATIVE",
      subjectId: id,
      actorId: input.actorId,
      kind: "initiative.proposed",
      summary: `Initiative "${input.title}" proposed`,
    });
    return id;
  }

  async setStatus(workspaceId: string, id: string, status: InitiativeStatus, actorId?: string) {
    const existing = await prisma.initiative.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("Initiative", id);
    const from = existing.status as InitiativeStatus;
    await prisma.initiative.update({ where: { id }, data: { status } });
    await changeEventService.append({
      workspaceId,
      subjectType: "INITIATIVE",
      subjectId: id,
      actorId,
      kind: "initiative.transitioned",
      summary: `Initiative ${from} → ${status}`,
      payload: { from, to: status },
    });
  }

  async list(workspaceId: string, filter: { status?: InitiativeStatus } = {}) {
    return prisma.initiative.findMany({
      where: {
        workspaceId,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(workspaceId: string, id: string) {
    const i = await prisma.initiative.findFirst({
      where: { id, workspaceId },
    });
    if (!i) throw notFound("Initiative", id);
    return i;
  }

  async timeline(workspaceId: string, id: string) {
    const initiative = await prisma.initiative.findFirst({
      where: { id, workspaceId },
      include: { campaigns: true, hypotheses: true, learnings: true },
    });
    if (!initiative) throw notFound("Initiative", id);

    const campaignIds = initiative.campaigns.map((c) => c.id);
    const channelCampaigns = await prisma.channelCampaign.findMany({
      where: { campaignId: { in: campaignIds } },
    });
    const ccIds = channelCampaigns.map((cc) => cc.id);

    const [events, annotations, performance] = await Promise.all([
      prisma.changeEvent.findMany({
        where: {
          workspaceId,
          OR: [
            { subjectType: "INITIATIVE", subjectId: id },
            { subjectType: "CAMPAIGN", subjectId: { in: campaignIds } },
            { subjectType: "CHANNEL_CAMPAIGN", subjectId: { in: ccIds } },
          ],
        },
        orderBy: { at: "asc" },
      }),
      prisma.annotation.findMany({
        where: {
          workspaceId,
          OR: [
            { subjectType: "INITIATIVE", subjectId: id },
            { subjectType: "CAMPAIGN", subjectId: { in: campaignIds } },
          ],
        },
        orderBy: { occurredAt: "asc" },
      }),
      prisma.performanceSnapshotDaily.findMany({
        where: { channelCampaignId: { in: ccIds } },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      initiative,
      campaigns: initiative.campaigns,
      hypotheses: initiative.hypotheses,
      learnings: initiative.learnings,
      events,
      annotations,
      performance,
    };
  }
}

export const initiativeService = new InitiativeService();
