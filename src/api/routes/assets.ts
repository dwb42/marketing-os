import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assetService } from "../../services/asset.service.js";
import {
  ActorReasonBody,
  AddAssetVersionSchema,
  AssetKindSchema,
  CreateAssetSchema,
  PatchAssetSchema,
  PatchAssetVersionContentSchema,
  WorkspaceIdSchema,
} from "../schemas.js";

export async function registerAssetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/assets", async (req) => {
    const body = CreateAssetSchema.parse(req.body);
    const id = await assetService.createAsset(body);
    return { id };
  });

  app.get("/assets", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        kind: AssetKindSchema.optional(),
        search: z.string().min(1).max(200).optional(),
        hasNoVersion: z
          .union([z.literal("true"), z.literal("false")])
          .optional()
          .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
      })
      .parse(req.query);
    return assetService.list(q.workspaceId, {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.search ? { search: q.search } : {}),
      ...(q.hasNoVersion !== undefined ? { hasNoVersion: q.hasNoVersion } : {}),
    });
  });

  app.get("/assets/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return assetService.get(q.workspaceId, p.id);
  });

  app.patch("/assets/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchAssetSchema.parse(req.body);
    const { actorId, reason, ...patch } = body;
    return assetService.update({
      workspaceId: q.workspaceId,
      assetId: p.id,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  app.delete("/assets/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ast_") }).parse(req.params);
    const q = ActorReasonBody.parse(req.query);
    const result = await assetService.delete({
      workspaceId: q.workspaceId,
      assetId: p.id,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
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

  app.post("/assets/versions/:vid/patch", async (req) => {
    const p = z.object({ vid: z.string().startsWith("ver_") }).parse(req.params);
    const body = PatchAssetVersionContentSchema.parse(req.body);
    return assetService.patchVersionContent({
      workspaceId: body.workspaceId,
      assetVersionId: p.vid,
      content: body.content,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.delete("/assets/versions/:vid", async (req) => {
    const p = z.object({ vid: z.string().startsWith("ver_") }).parse(req.params);
    const q = ActorReasonBody.parse(req.query);
    const result = await assetService.deleteVersion({
      workspaceId: q.workspaceId,
      assetVersionId: p.vid,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
  });
}
