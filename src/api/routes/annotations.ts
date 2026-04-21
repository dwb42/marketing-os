import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { annotationService } from "../../services/annotation.service.js";
import { ActorReasonBody, PatchAnnotationSchema, WorkspaceIdSchema } from "../schemas.js";

const CreateAnnotationSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  subjectType: z.string().min(1).max(50),
  subjectId: z.string().min(1).max(80),
  body: z.string().min(1).max(4000),
  occurredAt: z.coerce.date(),
  pinned: z.boolean().optional(),
  actorId: z.string().optional(),
});

export async function registerAnnotationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/annotations", async (req) => {
    const body = CreateAnnotationSchema.parse(req.body);
    const id = await annotationService.create(body);
    return { id };
  });

  app.get("/annotations", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        subjectType: z.string().optional(),
        subjectId: z.string().optional(),
        pinned: z
          .union([z.literal("true"), z.literal("false"), z.boolean()])
          .optional()
          .transform((v) =>
            v === undefined ? undefined : v === true || v === "true",
          ),
      })
      .parse(req.query);

    if (q.subjectType && q.subjectId) {
      return annotationService.listForSubject(q.workspaceId, q.subjectType, q.subjectId);
    }
    return annotationService.listForWorkspace(q.workspaceId, {
      ...(q.pinned !== undefined ? { pinned: q.pinned } : {}),
      ...(q.subjectType ? { subjectType: q.subjectType } : {}),
    });
  });

  app.get("/annotations/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ann_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return annotationService.get(q.workspaceId, p.id);
  });

  app.patch("/annotations/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ann_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchAnnotationSchema.parse(req.body);
    const { actorId, reason, ...patch } = body;
    return annotationService.update({
      workspaceId: q.workspaceId,
      id: p.id,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  app.delete("/annotations/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("ann_") }).parse(req.params);
    const q = ActorReasonBody.parse(req.query);
    const result = await annotationService.delete({
      workspaceId: q.workspaceId,
      id: p.id,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
  });
}
