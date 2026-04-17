import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { experimentService } from "../../services/experiment.service.js";
import { hypothesisService } from "../../services/hypothesis.service.js";
import { learningService } from "../../services/learning.service.js";
import { WorkspaceIdSchema } from "../schemas.js";

const CreateHypothesisSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  statement: z.string().min(1).max(1000),
  rationale: z.string().max(2000).optional(),
  initiativeId: z.string().startsWith("ini_").optional(),
  actorId: z.string().optional(),
});

const CreateExperimentSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  hypothesisId: z.string().startsWith("hyp_").optional(),
  actorId: z.string().optional(),
});

const ConcludeExperimentSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  conclusion: z.string().min(1).max(2000),
  actorId: z.string().optional(),
});

const CreateLearningSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  statement: z.string().min(1).max(2000),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  evidence: z
    .array(
      z.object({
        type: z.enum(["PERFORMANCE_WINDOW", "EXPERIMENT", "OUTCOME_WINDOW", "ANNOTATION", "FINDING", "OTHER"]),
        ref: z.string(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  initiativeId: z.string().startsWith("ini_").optional(),
  hypothesisId: z.string().startsWith("hyp_").optional(),
  experimentId: z.string().startsWith("exp_").optional(),
  validUntil: z.coerce.date().optional(),
  actorId: z.string().optional(),
});

export async function registerExperimentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/hypotheses", async (req) => {
    const body = CreateHypothesisSchema.parse(req.body);
    const id = await hypothesisService.create(body);
    return { id };
  });

  app.get("/hypotheses", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        initiativeId: z.string().startsWith("ini_").optional(),
      })
      .parse(req.query);
    return hypothesisService.list(q.workspaceId, q.initiativeId);
  });

  app.post("/experiments", async (req) => {
    const body = CreateExperimentSchema.parse(req.body);
    const id = await experimentService.design(body);
    return { id };
  });

  app.post("/experiments/:id/start", async (req) => {
    const p = z.object({ id: z.string().startsWith("exp_") }).parse(req.params);
    const body = z
      .object({ workspaceId: WorkspaceIdSchema, actorId: z.string().optional() })
      .parse(req.body);
    await experimentService.start(body.workspaceId, p.id, body.actorId);
    return { ok: true };
  });

  app.post("/experiments/:id/conclude", async (req) => {
    const p = z.object({ id: z.string().startsWith("exp_") }).parse(req.params);
    const body = ConcludeExperimentSchema.parse(req.body);
    await experimentService.conclude(body.workspaceId, p.id, body.conclusion, body.actorId);
    return { ok: true };
  });

  app.get("/experiments/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("exp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return experimentService.get(q.workspaceId, p.id);
  });

  app.get("/experiments", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        status: z
          .enum(["DESIGN", "RUNNING", "ANALYZING", "CONCLUDED", "ABORTED"])
          .optional(),
        hypothesisId: z.string().startsWith("hyp_").optional(),
        initiativeId: z.string().startsWith("ini_").optional(),
      })
      .parse(req.query);
    return experimentService.list(q.workspaceId, {
      ...(q.status ? { status: q.status } : {}),
      ...(q.hypothesisId ? { hypothesisId: q.hypothesisId } : {}),
      ...(q.initiativeId ? { initiativeId: q.initiativeId } : {}),
    });
  });

  app.post("/learnings", async (req) => {
    const body = CreateLearningSchema.parse(req.body);
    const id = await learningService.create(body);
    return { id };
  });

  app.get("/learnings", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        initiativeId: z.string().startsWith("ini_").optional(),
        hypothesisId: z.string().startsWith("hyp_").optional(),
      })
      .parse(req.query);
    return learningService.list(q.workspaceId, {
      initiativeId: q.initiativeId,
      hypothesisId: q.hypothesisId,
    });
  });
}
