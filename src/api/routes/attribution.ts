import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { attributionService } from "../../services/attribution.service.js";
import { ProductIdSchema } from "../schemas.js";

const MatchAttributionSchema = z.object({
  productId: ProductIdSchema,
  messageHash: z.string().min(8).max(200),
  senderHash: z.string().min(8).max(200),
  occurredAt: z.coerce.date(),
});

export async function registerAttributionRoutes(app: FastifyInstance): Promise<void> {
  // POST /attribution/match
  //
  // Given a chat-message fingerprint (hashes + timestamp), try to find
  // the cta_click outcome that led to it and return its sessionRef
  // (= pm_cid). Records every attempt to AttributionMatch for analytics.
  //
  // Callers: Pflegemax chatbot webhook worker.
  app.post("/attribution/match", async (req) => {
    const body = MatchAttributionSchema.parse(req.body);
    return attributionService.match(body);
  });
}
