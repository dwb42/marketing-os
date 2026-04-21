import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { proposalService } from "../../services/proposal.service.js";
import { DeleteProposalQuerySchema, PatchProposalSchema, WorkspaceIdSchema } from "../schemas.js";

const Area = z.enum(["data_model", "api", "reporting", "workflow", "other"]);

const CreateProposalSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  area: Area,
  title: z.string().min(1).max(200),
  rationale: z.string().min(1).max(4000),
  impact: z.string().max(2000).optional(),
  examples: z.array(z.string()).optional(),
  actorId: z.string().optional(),
});

export async function registerProposalRoutes(app: FastifyInstance): Promise<void> {
  app.post("/proposals", async (req) => {
    const body = CreateProposalSchema.parse(req.body);
    const id = await proposalService.submit(body);
    return { id };
  });

  app.get("/proposals", async (req) => {
    const q = z.object({ workspaceId: WorkspaceIdSchema, area: Area.optional() }).parse(req.query);
    return proposalService.list(q.workspaceId, q.area);
  });

  app.patch("/proposals/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("chg_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchProposalSchema.parse(req.body);
    const { actorId, reason, ...patch } = body;
    return proposalService.update({
      workspaceId: q.workspaceId,
      proposalId: p.id,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  app.delete("/proposals/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("chg_") }).parse(req.params);
    const q = DeleteProposalQuerySchema.parse(req.query);
    const result = await proposalService.delete({
      workspaceId: q.workspaceId,
      proposalId: p.id,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
  });
}
