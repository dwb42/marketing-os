import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { performanceService } from "../../services/performance.service.js";

export async function registerPerformanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/performance", async (req) => {
    const q = z
      .object({
        channelCampaignId: z.string().startsWith("ccp_"),
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .parse(req.query);
    const rows = await performanceService.query(q.channelCampaignId, q.from, q.to);
    // BigInt-Serialisierung: costMicros → string (JSON-sicher)
    return rows.map((r) => ({ ...r, costMicros: r.costMicros.toString() }));
  });
}
