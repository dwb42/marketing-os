import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { initiativeService } from "../../services/initiative.service.js";
import { CreateInitiativeSchema, InitiativeIdSchema, WorkspaceIdSchema } from "../schemas.js";

const InitiativeStatusSchema = z.enum([
  "PROPOSED",
  "ACTIVE",
  "ON_HOLD",
  "DONE",
  "CANCELLED",
]);

export async function registerInitiativeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/initiatives", async (req) => {
    const body = CreateInitiativeSchema.parse(req.body);
    const id = await initiativeService.propose(body);
    return { id };
  });

  app.get("/initiatives", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        status: InitiativeStatusSchema.optional(),
      })
      .parse(req.query);
    return initiativeService.list(q.workspaceId, {
      ...(q.status ? { status: q.status } : {}),
    });
  });

  app.get("/initiatives/:id", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return initiativeService.get(q.workspaceId, p.id);
  });

  app.get("/initiatives/:id/timeline", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return initiativeService.timeline(q.workspaceId, p.id);
  });
}
