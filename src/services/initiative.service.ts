import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
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

  async update(params: {
    workspaceId: string;
    id: string;
    patch: {
      title?: string;
      goal?: string;
      hypothesis?: string | null;
      successCriteria?: string | null;
      modules?: string[];
      outcomeLadder?: string[];
      learnQuestions?: string[];
      assumptions?: string[];
      risks?: string[];
      startsAt?: Date | null;
      endsAt?: Date | null;
      metadata?: Record<string, unknown>;
    };
    actorId?: string;
    reason?: string;
  }) {
    const existing = await prisma.initiative.findFirst({
      where: { id: params.id, workspaceId: params.workspaceId },
    });
    if (!existing) throw notFound("Initiative", params.id);
    const data: Record<string, unknown> = {};
    const touched: string[] = [];
    for (const key of Object.keys(params.patch) as Array<keyof typeof params.patch>) {
      const val = params.patch[key];
      if (val === undefined) continue;
      touched.push(key);
      if (Array.isArray(val) || (val !== null && typeof val === "object")) {
        data[key] = val as object;
      } else {
        data[key] = val;
      }
    }
    if (touched.length === 0) {
      throw invalidInput("PATCH body must contain at least one field to change");
    }

    const before: Record<string, unknown> = {};
    for (const k of touched) {
      before[k] = (existing as unknown as Record<string, unknown>)[k];
    }

    const updated = await prisma.initiative.update({ where: { id: params.id }, data });
    const after: Record<string, unknown> = {};
    for (const k of touched) {
      after[k] = (updated as unknown as Record<string, unknown>)[k];
    }
    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "INITIATIVE",
      subjectId: params.id,
      actorId: params.actorId,
      kind: "initiative.patched",
      summary: `Initiative patched (${touched.join(", ")})`,
      payload: { before, after, reason: params.reason ?? null },
    });
    return updated;
  }

  async archive(workspaceId: string, id: string, actorId?: string, reason?: string) {
    const existing = await prisma.initiative.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("Initiative", id);
    if (existing.status === "ON_HOLD") return existing;
    const updated = await prisma.initiative.update({
      where: { id },
      data: { status: "ON_HOLD" },
    });
    await changeEventService.append({
      workspaceId,
      subjectType: "INITIATIVE",
      subjectId: id,
      actorId,
      kind: "initiative.archived",
      summary: `Initiative "${existing.title}" archiviert (ON_HOLD)`,
      payload: { from: existing.status, to: "ON_HOLD", reason: reason ?? null },
    });
    return updated;
  }

  async restore(workspaceId: string, id: string, actorId?: string, reason?: string) {
    const existing = await prisma.initiative.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("Initiative", id);
    if (existing.status !== "ON_HOLD") {
      throw invalidState(
        `Initiative status is ${existing.status}; restore only allowed from ON_HOLD`,
      );
    }
    const updated = await prisma.initiative.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    await changeEventService.append({
      workspaceId,
      subjectType: "INITIATIVE",
      subjectId: id,
      actorId,
      kind: "initiative.restored",
      summary: `Initiative "${existing.title}" zurück auf ACTIVE`,
      payload: { from: "ON_HOLD", to: "ACTIVE", reason: reason ?? null },
    });
    return updated;
  }

  async delete(params: {
    workspaceId: string;
    id: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const existing = await prisma.initiative.findFirst({
      where: { id: params.id, workspaceId: params.workspaceId },
      include: {
        _count: {
          select: {
            campaigns: true,
            clusters: true,
            findings: true,
            hypotheses: true,
            learnings: true,
          },
        },
      },
    });
    if (!existing) throw notFound("Initiative", params.id);
    const blockers = existing._count;
    const total =
      blockers.campaigns + blockers.clusters + blockers.findings + blockers.hypotheses + blockers.learnings;
    if (total > 0) {
      throw invalidState(
        `Initiative ${params.id} is referenced by ${total} child(ren); detach or delete them first`,
        { blockers },
      );
    }

    const correctsId = newId("changeEvent");
    await prisma.$transaction([
      prisma.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "INITIATIVE",
          subjectId: params.id,
          actorId: params.actorId ?? null,
          kind: "initiative.deleted",
          summary: `Initiative "${existing.title}" hard-deleted`,
          correctsId: params.id,
          payload: {
            title: existing.title,
            goal: existing.goal,
            status: existing.status,
            reason: params.reason ?? null,
          },
        },
      }),
      prisma.initiative.delete({ where: { id: params.id } }),
    ]);
    return { deleted: true, correctsId };
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
