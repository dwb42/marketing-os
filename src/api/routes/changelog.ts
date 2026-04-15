import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { changeEventService } from "../../services/change-event.service.js";
import { WorkspaceIdSchema } from "../schemas.js";

export async function registerChangelogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/changelog", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        subjectType: z.string().optional(),
        subjectId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);

    if (q.subjectType && q.subjectId) {
      return changeEventService.listForSubject(q.workspaceId, q.subjectType, q.subjectId);
    }
    const from = q.from ?? new Date(0);
    const to = q.to ?? new Date();
    return changeEventService.listInRange(q.workspaceId, from, to);
  });
}
