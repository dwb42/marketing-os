import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { approvalService } from "../../services/approval.service.js";
import { CreateApprovalSchema } from "../schemas.js";
import { WorkspaceIdSchema } from "../schemas.js";

const ApprovalDecisionSchema = z.enum([
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
]);

export async function registerApprovalRoutes(app: FastifyInstance): Promise<void> {
  app.post("/approvals", async (req) => {
    const body = CreateApprovalSchema.parse(req.body);
    const id = await approvalService.record(body);
    return { id };
  });

  app.get("/approvals", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        targetType: z.string().optional(),
        targetId: z.string().optional(),
        decision: ApprovalDecisionSchema.optional(),
      })
      .parse(req.query);
    return approvalService.list(q.workspaceId, {
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.decision ? { decision: q.decision } : {}),
    });
  });
}
