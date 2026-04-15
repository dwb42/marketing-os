import type { FastifyInstance } from "fastify";
import { approvalService } from "../../services/approval.service.js";
import { CreateApprovalSchema } from "../schemas.js";

export async function registerApprovalRoutes(app: FastifyInstance): Promise<void> {
  app.post("/approvals", async (req) => {
    const body = CreateApprovalSchema.parse(req.body);
    const id = await approvalService.record(body);
    return { id };
  });
}
