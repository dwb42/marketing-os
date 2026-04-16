import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clusterService } from "../../services/cluster.service.js";
import { WorkspaceIdSchema, ProductIdSchema } from "../schemas.js";

const ClusterStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]);
const ClusterValidationSchema = z.enum(["HYPOTHESIS", "WEAK_EVIDENCE", "EVIDENCED", "REFUTED"]);

const CreateClusterSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  productId: ProductIdSchema,
  name: z.string().min(1).max(200),
  modulPrimary: z.string().min(1).max(100),
  initiativeId: z.string().startsWith("ini_").optional(),
  modulSecondary: z.array(z.string()).optional(),
  outcome: z.string().max(200).optional(),
  lebenslage: z.string().max(2000).optional(),
  suchbegriffe: z.array(z.string()).optional(),
  naechsteAktion: z.string().max(1000).optional(),
  friktionspunkte: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  actorId: z.string().optional(),
});

const PatchClusterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  modulPrimary: z.string().min(1).max(100).optional(),
  modulSecondary: z.array(z.string()).optional(),
  outcome: z.string().max(200).optional(),
  lebenslage: z.string().max(2000).optional(),
  suchbegriffe: z.array(z.string()).optional(),
  naechsteAktion: z.string().max(1000).optional(),
  friktionspunkte: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  initiativeId: z.string().startsWith("ini_").optional(),
  status: ClusterStatusSchema.optional(),
  actorId: z.string().optional(),
});

const ValidateClusterSchema = z.object({
  validation: ClusterValidationSchema,
  actorId: z.string().optional(),
});

export async function registerClusterRoutes(app: FastifyInstance): Promise<void> {
  app.post("/clusters", async (req) => {
    const body = CreateClusterSchema.parse(req.body);
    const id = await clusterService.create(body);
    return { id };
  });

  app.get("/clusters", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        productId: ProductIdSchema.optional(),
        status: ClusterStatusSchema.optional(),
        validation: ClusterValidationSchema.optional(),
        initiativeId: z.string().startsWith("ini_").optional(),
      })
      .parse(req.query);
    return clusterService.list(q.workspaceId, q);
  });

  app.get("/clusters/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("clu_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return clusterService.get(q.workspaceId, p.id);
  });

  app.patch("/clusters/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("clu_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchClusterSchema.parse(req.body);
    const { actorId, ...fields } = body;
    await clusterService.update(q.workspaceId, p.id, fields, actorId);
    return { ok: true };
  });

  app.post("/clusters/:id/validate", async (req) => {
    const p = z.object({ id: z.string().startsWith("clu_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = ValidateClusterSchema.parse(req.body);
    await clusterService.setValidation(q.workspaceId, p.id, body.validation, body.actorId);
    return { ok: true };
  });
}
