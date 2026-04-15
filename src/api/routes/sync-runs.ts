import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../services/prisma.js";
import { syncRunService } from "../../services/sync-run.service.js";
import { WorkspaceIdSchema } from "../schemas.js";
import { notFound } from "../../lib/errors.js";

const CreateSyncRunSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  channel: z.enum(["GOOGLE_ADS", "META_ADS"]),
  type: z.enum(["PULL_PERFORMANCE", "PUSH_CAMPAIGN", "PUSH_ASSET_VERSION"]),
  targetType: z.string(),
  targetId: z.string(),
  idempotencyKey: z.string().min(8).max(200),
  input: z.record(z.unknown()).default({}),
});

function serialize<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out as T;
}

export async function registerSyncRunRoutes(app: FastifyInstance): Promise<void> {
  app.post("/sync-runs", async (req) => {
    const body = CreateSyncRunSchema.parse(req.body);
    const res = await syncRunService.createOrGet(body);
    return res;
  });

  app.get("/sync-runs/:id", async (req) => {
    const p = z.object({ id: z.string().startsWith("syn_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    const r = await prisma.syncRun.findFirst({ where: { id: p.id, workspaceId: q.workspaceId } });
    if (!r) throw notFound("SyncRun", p.id);
    return serialize(r);
  });

  app.get("/sync-runs", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "PARTIAL"]).optional(),
        channel: z.enum(["GOOGLE_ADS", "META_ADS"]).optional(),
      })
      .parse(req.query);
    const rows = await prisma.syncRun.findMany({
      where: {
        workspaceId: q.workspaceId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.channel ? { channel: q.channel } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(serialize);
  });
}
