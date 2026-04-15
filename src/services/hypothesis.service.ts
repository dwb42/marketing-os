import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { changeEventService } from "./change-event.service.js";

export class HypothesisService {
  async create(input: {
    workspaceId: string;
    statement: string;
    rationale?: string;
    initiativeId?: string;
    actorId?: string;
  }): Promise<string> {
    const id = newId("hypothesis");
    await prisma.hypothesis.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        statement: input.statement,
        rationale: input.rationale ?? null,
        initiativeId: input.initiativeId ?? null,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "HYPOTHESIS",
      subjectId: id,
      actorId: input.actorId,
      kind: "hypothesis.created",
      summary: input.statement.slice(0, 120),
    });
    return id;
  }

  async list(workspaceId: string, initiativeId?: string) {
    return prisma.hypothesis.findMany({
      where: { workspaceId, ...(initiativeId ? { initiativeId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const hypothesisService = new HypothesisService();
