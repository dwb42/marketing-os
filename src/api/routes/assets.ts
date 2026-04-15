import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assetService } from "../../services/asset.service.js";
import { AddAssetVersionSchema, CreateAssetSchema, WorkspaceIdSchema } from "../schemas.js";

export async function registerAssetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/assets", async (req) => {
    const body = CreateAssetSchema.parse(req.body);
    const id = await assetService.createAsset(body);
    return { id };
  });

  app.post("/assets/:id/versions", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const body = AddAssetVersionSchema.parse(req.body);
    const id = await assetService.addVersion({
      workspaceId: body.workspaceId,
      assetId: p.id,
      content: body.content,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
    });
    return { id };
  });

  app.get("/assets/:id/versions", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return assetService.listVersions(q.workspaceId, p.id);
  });

  app.get("/assets/:id/diff", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        a: z.string().startsWith("ver_"),
        b: z.string().startsWith("ver_"),
      })
      .parse(req.query);
    return assetService.diffVersions(q.workspaceId, p.id, q.a, q.b);
  });

  app.post("/assets/versions/:vid/transition", async (req) => {
    const p = z.object({ vid: z.string().startsWith("ver_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        to: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "SUPERSEDED"]),
        actorId: z.string().optional(),
      })
      .parse(req.body);
    await assetService.transitionVersion({
      workspaceId: body.workspaceId,
      assetVersionId: p.vid,
      to: body.to,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
    });
    return { ok: true };
  });
}
