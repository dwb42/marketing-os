import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { initiativeService } from "../../services/initiative.service.js";
import { CreateInitiativeSchema, InitiativeIdSchema, WorkspaceIdSchema } from "../schemas.js";

export async function registerInitiativeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/initiatives", async (req) => {
    const body = CreateInitiativeSchema.parse(req.body);
    const id = await initiativeService.propose(body);
    return { id };
  });

  app.get("/initiatives/:id/timeline", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return initiativeService.timeline(q.workspaceId, p.id);
  });
}
