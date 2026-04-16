import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { changeEventService } from "./change-event.service.js";

export type LearningConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface LearningEvidence {
  type: "PERFORMANCE_WINDOW" | "EXPERIMENT" | "OUTCOME_WINDOW" | "ANNOTATION" | "FINDING" | "OTHER";
  ref: string;
  note?: string;
}

export class LearningService {
  async create(input: {
    workspaceId: string;
    statement: string;
    confidence?: LearningConfidence;
    evidence?: LearningEvidence[];
    initiativeId?: string;
    hypothesisId?: string;
    experimentId?: string;
    validUntil?: Date;
    actorId?: string;
  }): Promise<string> {
    const id = newId("learning");
    await prisma.learning.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        statement: input.statement,
        confidence: input.confidence ?? "MEDIUM",
        evidence: (input.evidence ?? []) as object,
        initiativeId: input.initiativeId ?? null,
        hypothesisId: input.hypothesisId ?? null,
        experimentId: input.experimentId ?? null,
        validUntil: input.validUntil ?? null,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "LEARNING",
      subjectId: id,
      actorId: input.actorId,
      kind: "learning.created",
      summary: input.statement.slice(0, 120),
      payload: { confidence: input.confidence ?? "MEDIUM" },
    });
    return id;
  }

  async list(workspaceId: string, filter: { initiativeId?: string; hypothesisId?: string } = {}) {
    return prisma.learning.findMany({
      where: {
        workspaceId,
        ...(filter.initiativeId ? { initiativeId: filter.initiativeId } : {}),
        ...(filter.hypothesisId ? { hypothesisId: filter.hypothesisId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const learningService = new LearningService();
