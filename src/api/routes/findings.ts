import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findingService } from "../../services/finding.service.js";
import { WorkspaceIdSchema } from "../schemas.js";

const FindingStatusSchema = z.enum(["OPEN", "ADDRESSED", "WONT_FIX", "ARCHIVED"]);
const FindingConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

const CreateFindingSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  beobachtung: z.string().min(1).max(4000),
  interpretation: z.string().min(1).max(4000),
  empfehlung: z.string().min(1).max(4000),
  initiativeId: z.string().startsWith("ini_").optional(),
  clusterId: z.string().startsWith("clu_").optional(),
  modulBetroffen: z.string().max(200).optional(),
  outcomeBetroffen: z.string().max(200).optional(),
  konfidenz: FindingConfidenceSchema.optional(),
  konfidenzGrund: z.string().max(2000).optional(),
  empfehlungAn: z.string().max(200).optional(),
  datenLuecke: z.string().max(2000).optional(),
  actorId: z.string().optional(),
});

const SetFindingStatusSchema = z.object({
  status: FindingStatusSchema,
  actorId: z.string().optional(),
});

export async function registerFindingRoutes(app: FastifyInstance): Promise<void> {
  app.post("/findings", async (req) => {
    const body = CreateFindingSchema.parse(req.body);
    const id = await findingService.create(body);
    return { id };
  });

  app.get("/findings", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        initiativeId: z.string().startsWith("ini_").optional(),
        clusterId: z.string().startsWith("clu_").optional(),
        status: FindingStatusSchema.optional(),
      })
      .parse(req.query);
    return findingService.list(q.workspaceId, q);
  });

  app.get("/findings/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("fnd_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return findingService.get(q.workspaceId, p.id);
  });

  app.post("/findings/:id/status", async (req) => {
    const p = z.object({ id: z.string().startsWith("fnd_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = SetFindingStatusSchema.parse(req.body);
    await findingService.setStatus(q.workspaceId, p.id, body.status, body.actorId);
    return { ok: true };
  });
}
