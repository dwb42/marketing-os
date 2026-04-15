import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { changeEventService } from "./change-event.service.js";
import type { ApprovalDecision } from "../domain/status.js";

export class ApprovalService {
  async record(input: {
    workspaceId: string;
    targetType: string;
    targetId: string;
    decision: ApprovalDecision;
    comment?: string;
    actorId?: string;
  }): Promise<string> {
    const id = newId("approval");
    await prisma.approval.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        decision: input.decision,
        comment: input.comment ?? null,
        actorId: input.actorId ?? null,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "APPROVAL",
      subjectId: id,
      actorId: input.actorId,
      kind: "approval.recorded",
      summary: `${input.decision} on ${input.targetType} ${input.targetId}`,
      payload: {
        targetType: input.targetType,
        targetId: input.targetId,
        decision: input.decision,
      },
    });
    return id;
  }

  async listForTarget(workspaceId: string, targetType: string, targetId: string) {
    return prisma.approval.findMany({
      where: { workspaceId, targetType, targetId },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const approvalService = new ApprovalService();
