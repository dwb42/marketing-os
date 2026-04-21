import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { initiativeService } from "../../services/initiative.service.js";
import {
  ActorReasonBody,
  CreateInitiativeSchema,
  InitiativeIdSchema,
  PatchInitiativeSchema,
  WorkspaceIdSchema,
} from "../schemas.js";

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

  app.patch("/initiatives/:id", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const body = PatchInitiativeSchema.parse(req.body);
    const { actorId, reason, ...patch } = body;
    return initiativeService.update({
      workspaceId: q.workspaceId,
      id: p.id,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  app.post("/initiatives/:id/archive", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const body = ActorReasonBody.parse(req.body);
    return initiativeService.archive(body.workspaceId, p.id, body.actorId, body.reason);
  });

  app.post("/initiatives/:id/restore", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const body = ActorReasonBody.parse(req.body);
    return initiativeService.restore(body.workspaceId, p.id, body.actorId, body.reason);
  });

  app.delete("/initiatives/:id", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = ActorReasonBody.parse(req.query);
    const result = await initiativeService.delete({
      workspaceId: q.workspaceId,
      id: p.id,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
    return { ok: true, ...result };
  });

  app.get("/initiatives/:id/timeline", async (req) => {
    const p = z.object({ id: InitiativeIdSchema }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return initiativeService.timeline(q.workspaceId, p.id);
  });
}
