import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { annotationService } from "../../services/annotation.service.js";
import { WorkspaceIdSchema } from "../schemas.js";

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
        subjectType: z.string(),
        subjectId: z.string(),
      })
      .parse(req.query);
    return annotationService.listForSubject(q.workspaceId, q.subjectType, q.subjectId);
  });
}
