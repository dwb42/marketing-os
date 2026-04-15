import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { outcomeService } from "../../services/outcome.service.js";
import { IngestOutcomeSchema, ProductIdSchema } from "../schemas.js";

export async function registerOutcomeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/outcomes", async (req) => {
    const body = IngestOutcomeSchema.parse(req.body);
    const id = await outcomeService.ingest(body);
    return { id };
  });

  app.get("/outcomes", async (req) => {
    const q = z
      .object({
        productId: ProductIdSchema,
        type: z.string().optional(),
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .parse(req.query);
    return outcomeService.query(q);
  });
}
