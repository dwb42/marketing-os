import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchService } from "../../services/search.service.js";
import { WorkspaceIdSchema } from "../schemas.js";

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/search", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        q: z.string().optional(),
        initiativeId: z.string().startsWith("ini_").optional(),
        clusterId: z.string().startsWith("clu_").optional(),
        status: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);
    return searchService.search(q);
  });
}
