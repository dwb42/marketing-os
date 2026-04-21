import type { FastifyInstance } from "fastify";
import { campaignService } from "../../services/campaign.service.js";
import {
  CampaignAssetRoleSchema,
  CreateCampaignSchema,
  DeleteCampaignQuerySchema,
  LinkCampaignAssetSchema,
  PatchCampaignSchema,
  TransitionCampaignSchema,
  WorkspaceIdSchema,
  CampaignStatusSchema,
  AssetIdSchema,
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

  app.patch("/campaigns/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchCampaignSchema.parse(req.body);
    const { actorId, reason, ...patch } = body;
    return campaignService.update({
      workspaceId: q.workspaceId,
      campaignId: p.id,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  app.delete("/campaigns/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = DeleteCampaignQuerySchema.parse(req.query);
    const result = await campaignService.delete({
      workspaceId: q.workspaceId,
      campaignId: p.id,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
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

  app.post("/campaigns/:id/assets", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = LinkCampaignAssetSchema.parse(req.body);
    const result = await campaignService.linkAsset({
      workspaceId: q.workspaceId,
      campaignId: p.id,
      assetId: body.assetId,
      role: body.role,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
    return { ok: true, ...result };
  });

  app.get("/campaigns/:id/assets", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return campaignService.listAssets(q.workspaceId, p.id);
  });

  app.delete("/campaigns/:id/assets/:assetId/:role", async (req) => {
    const p = z
      .object({
        id: z.string().startsWith("cmp_"),
        assetId: AssetIdSchema,
        role: CampaignAssetRoleSchema,
      })
      .parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.query);
    const result = await campaignService.unlinkAsset({
      workspaceId: q.workspaceId,
      campaignId: p.id,
      assetId: p.assetId,
      role: p.role,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
  });
}
