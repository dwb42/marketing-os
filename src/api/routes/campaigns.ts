import type { FastifyInstance } from "fastify";
import { campaignService } from "../../services/campaign.service.js";
import {
  CreateCampaignSchema,
  TransitionCampaignSchema,
  WorkspaceIdSchema,
  CampaignStatusSchema,
} from "../schemas.js";
import { z } from "zod";

export async function registerCampaignRoutes(app: FastifyInstance): Promise<void> {
  app.post("/campaigns", async (req) => {
    const body = CreateCampaignSchema.parse(req.body);
    const id = await campaignService.createDraft(body);
    return { id };
  });

  app.get("/campaigns", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        productId: z.string().optional(),
        status: CampaignStatusSchema.optional(),
      })
      .parse(req.query);
    return campaignService.list(q.workspaceId, {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.status ? { status: q.status } : {}),
    });
  });

  app.get("/campaigns/:id", async (req) => {
    const p = z
      .object({ id: z.string().startsWith("cmp_") })
      .parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return campaignService.get(q.workspaceId, p.id);
  });

  app.post("/campaigns/:id/transition", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = TransitionCampaignSchema.parse(req.body);
    await campaignService.transition({
      workspaceId: q.workspaceId,
      campaignId: p.id,
      to: body.to,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
    return { ok: true };
  });
}
