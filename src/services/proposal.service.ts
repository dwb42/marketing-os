import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
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
}

export const proposalService = new ProposalService();
