import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { loadEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { DomainError } from "../lib/errors.js";
import { registerAuth } from "./plugins/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerCampaignRoutes } from "./routes/campaigns.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerInitiativeRoutes } from "./routes/initiatives.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerOutcomeRoutes } from "./routes/outcomes.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";
import { registerExperimentRoutes } from "./routes/experiments.js";
import { registerAnnotationRoutes } from "./routes/annotations.js";
import { registerPerformanceRoutes } from "./routes/performance.js";
import { registerChangelogRoutes } from "./routes/changelog.js";
import { registerSyncRunRoutes } from "./routes/sync-runs.js";
import { registerProposalRoutes } from "./routes/proposals.js";
import { registerClusterRoutes } from "./routes/clusters.js";
import { registerFindingRoutes } from "./routes/findings.js";
import { registerSearchRoutes } from "./routes/search.js";

// JSON-Serializer, der BigInt (Prisma costMicros) als String ausgibt.
// Ohne das würde Fastify bei BigInt-Feldern werfen.
const jsonSerializer = (payload: unknown): string =>
  JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

export async function buildServer(): Promise<FastifyInstance> {
  const env = loadEnv();
  const app: FastifyInstance = Fastify({
    logger: { level: env.LOG_LEVEL },
    disableRequestLogging: false,
  });
  void logger; // reserved for non-request logging contexts

  // Fastify ruft unseren Serializer für alle handler-Return-Objekte auf.
  // Damit sind BigInt und Prisma-Decimals JSON-sicher.
  app.addHook("preSerialization", async (_req, _reply, payload) => payload);
  app.setReplySerializer((payload, _statusCode) => jsonSerializer(payload));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "INVALID_INPUT", message: "Validation failed", details: err.issues },
      });
    }
    if (err instanceof DomainError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        CONFLICT: 409,
        INVALID_INPUT: 400,
        INVALID_STATE: 409,
        FORBIDDEN: 403,
        UNAUTHENTICATED: 401,
        INTERNAL: 500,
      };
      return reply.status(statusMap[err.code] ?? 500).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    logger.error({ err }, "unhandled error");
    return reply.status(500).send({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  });

  await app.register(cors, {
    origin: [
      "https://pflegeberatung.b42.io",
      "http://localhost:3099",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await registerAuth(app);

  await registerHealthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerCampaignRoutes(app);
  await registerAssetRoutes(app);
  await registerInitiativeRoutes(app);
  await registerApprovalRoutes(app);
  await registerOutcomeRoutes(app);
  await registerExperimentRoutes(app);
  await registerAnnotationRoutes(app);
  await registerPerformanceRoutes(app);
  await registerChangelogRoutes(app);
  await registerSyncRunRoutes(app);
  await registerProposalRoutes(app);
  await registerClusterRoutes(app);
  await registerFindingRoutes(app);
  await registerSearchRoutes(app);

  logger.info({ port: env.PORT }, "server ready");
  return app;
}
