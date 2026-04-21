import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";

// Agenten können Verbesserungsvorschläge zur Plattform selbst einreichen.
// MVP: wir persistieren sie als ChangeEvent mit subjectType="PLATFORM" und
// einem kind="proposal.submitted". Eine eigene Proposal-Tabelle folgt in
// Phase 2. Das reicht, um Proposals abfragbar und timeline-fähig zu machen.

export type ProposalArea = "data_model" | "api" | "reporting" | "workflow" | "other";

export class ProposalService {
  async submit(input: {
    workspaceId: string;
    area: ProposalArea;
    title: string;
    rationale: string;
    impact?: string;
    examples?: string[];
    actorId?: string;
  }): Promise<string> {
    const id = newId("changeEvent");
    await prisma.changeEvent.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        subjectType: "PLATFORM",
        subjectId: `proposal:${input.area}`,
        actorId: input.actorId ?? null,
        kind: "proposal.submitted",
        summary: input.title,
        payload: {
          area: input.area,
          rationale: input.rationale,
          impact: input.impact ?? null,
          examples: input.examples ?? [],
        } as object,
      },
    });
    return id;
  }

  async list(workspaceId: string, area?: ProposalArea) {
    return prisma.changeEvent.findMany({
      where: {
        workspaceId,
        subjectType: "PLATFORM",
        kind: "proposal.submitted",
        ...(area ? { subjectId: `proposal:${area}` } : {}),
      },
      orderBy: { at: "desc" },
    });
  }

  async update(params: {
    workspaceId: string;
    proposalId: string;
    patch: { title?: string; rationale?: string; impact?: string | null; examples?: string[] };
    actorId?: string;
    reason?: string;
  }) {
    const existing = await prisma.changeEvent.findFirst({
      where: {
        id: params.proposalId,
        workspaceId: params.workspaceId,
        subjectType: "PLATFORM",
        kind: "proposal.submitted",
      },
    });
    if (!existing) throw notFound("Proposal", params.proposalId);
    const payload = (existing.payload as Record<string, unknown>) ?? {};
    const data: Record<string, unknown> = { ...payload };
    const touched: string[] = [];
    if (params.patch.title !== undefined) {
      touched.push("title");
    }
    if (params.patch.rationale !== undefined) {
      data.rationale = params.patch.rationale;
      touched.push("rationale");
    }
    if (params.patch.impact !== undefined) {
      data.impact = params.patch.impact;
      touched.push("impact");
    }
    if (params.patch.examples !== undefined) {
      data.examples = params.patch.examples;
      touched.push("examples");
    }
    if (touched.length === 0) {
      throw invalidInput("PATCH body must contain at least one mutable field");
    }

    const before = {
      title: existing.summary,
      rationale: payload.rationale,
      impact: payload.impact,
      examples: payload.examples,
    };
    const updated = await prisma.changeEvent.update({
      where: { id: params.proposalId },
      data: {
        ...(params.patch.title !== undefined ? { summary: params.patch.title } : {}),
        payload: data as object,
      },
    });
    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "PLATFORM",
      subjectId: existing.subjectId,
      actorId: params.actorId,
      kind: "proposal.patched",
      summary: `Proposal patched (${touched.join(", ")})`,
      payload: {
        proposalId: params.proposalId,
        before,
        after: {
          title: updated.summary,
          rationale: (updated.payload as Record<string, unknown>).rationale,
          impact: (updated.payload as Record<string, unknown>).impact,
          examples: (updated.payload as Record<string, unknown>).examples,
        },
        reason: params.reason ?? null,
      },
    });
    return updated;
  }

  async delete(params: {
    workspaceId: string;
    proposalId: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const existing = await prisma.changeEvent.findFirst({
      where: {
        id: params.proposalId,
        workspaceId: params.workspaceId,
        subjectType: "PLATFORM",
        kind: "proposal.submitted",
      },
    });
    if (!existing) throw notFound("Proposal", params.proposalId);

    const correctsId = newId("changeEvent");
    await prisma.$transaction([
      prisma.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "PLATFORM",
          subjectId: existing.subjectId,
          actorId: params.actorId ?? null,
          kind: "proposal.deleted",
          summary: `Proposal "${existing.summary}" deleted`,
          correctsId: params.proposalId,
          payload: {
            originalSummary: existing.summary,
            originalPayload: existing.payload,
            reason: params.reason ?? null,
          },
        },
      }),
      prisma.changeEvent.delete({ where: { id: params.proposalId } }),
    ]);

    return { deleted: true, correctsId };
  }
}

export const proposalService = new ProposalService();
