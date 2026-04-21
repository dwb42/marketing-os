import type { FastifyInstance } from "fastify";

// Discovery-Antwort für den Root-Endpoint. Agenten nutzen das, um ohne
// vorheriges Wissen die verfügbaren API-Flächen zu finden.
const API_INDEX = {
  service: "marketing-os",
  version: "0.1.0",
  groups: {
    tenancy: [
      "GET /workspaces",
      "POST /workspaces",
      "POST /brands",
      "GET /brands?workspaceId=…",
      "POST /products",
      "GET /products?workspaceId=…",
      "POST /audience-segments",
      "GET /audience-segments?workspaceId=…&productId=…",
    ],
    initiatives: [
      "POST /initiatives",
      "GET /initiatives?workspaceId=…&status=…",
      "GET /initiatives/:id",
      "PATCH /initiatives/:id",
      "POST /initiatives/:id/archive",
      "POST /initiatives/:id/restore",
      "DELETE /initiatives/:id?workspaceId=…&actorId=…",
      "GET /initiatives/:id/timeline",
    ],
    campaigns: [
      "POST /campaigns",
      "GET /campaigns",
      "GET /campaigns/:id",
      "PATCH /campaigns/:id",
      "DELETE /campaigns/:id?workspaceId=&actorId=&reason=",
      "POST /campaigns/:id/transition",
      "POST /campaigns/:id/assets",
      "GET /campaigns/:id/assets",
      "DELETE /campaigns/:id/assets/:assetId/:role",
    ],
    assets: [
      "POST /assets",
      "GET /assets?workspaceId=…&kind=…&search=…&hasNoVersion=true",
      "GET /assets/:id",
      "PATCH /assets/:id",
      "DELETE /assets/:id?workspaceId=…&actorId=…",
      "POST /assets/:id/versions",
      "GET /assets/:id/versions",
      "GET /assets/:id/diff?a=ver_…&b=ver_…",
      "POST /assets/versions/:vid/transition",
      "POST /assets/versions/:vid/patch  (content update, DRAFT only)",
      "DELETE /assets/versions/:vid?workspaceId=…  (DRAFT | SUPERSEDED only)",
    ],
    approvals: ["POST /approvals"],
    experiments: [
      "POST /hypotheses",
      "GET /hypotheses",
      "POST /experiments",
      "POST /experiments/:id/start",
      "POST /experiments/:id/conclude",
      "GET /experiments/:id",
      "POST /learnings",
      "GET /learnings",
    ],
    annotations: [
      "POST /annotations",
      "GET /annotations",
      "GET /annotations/:id",
      "PATCH /annotations/:id",
      "DELETE /annotations/:id?workspaceId=…&actorId=…",
    ],
    reporting: ["GET /performance", "GET /outcomes", "POST /outcomes", "GET /changelog"],
    sync: [
      "POST /sync-runs",
      "GET /sync-runs",
      "GET /sync-runs/:id",
      "POST /campaigns/:id/sync",
      "POST /campaigns/:id/re-sync",
    ],
    channelMutations: [
      "POST /channel-campaigns/:ccId/status  (ENABLED|PAUSED)",
      "POST /channel-campaigns/:ccId/budget  (amountMicros|amountEur)",
      "POST /channel-campaigns/:ccId/negative-keywords",
      "POST /channel-ad-groups/:agId/status",
      "POST /channel-ad-groups/:agId/bid",
      "POST /channel-ad-groups/:agId/keywords",
      "POST /channel-ad-groups/:agId/ads  (new RSA)",
      "POST /channel-ads/:adId/status",
      "PATCH /channel-ads/:adId  (headlines/descriptions/paths/finalUrls)",
      "POST /channel-keywords/:kwId/status",
      "DELETE /channel-keywords/:kwId  (marks REMOVED on GA + locally; preserves performance history)",
    ],
    clusters: [
      "POST /clusters",
      "GET /clusters",
      "GET /clusters/:id",
      "PATCH /clusters/:id",
      "POST /clusters/:id/validate",
    ],
    findings: [
      "POST /findings",
      "GET /findings",
      "GET /findings/:id",
      "POST /findings/:id/status",
    ],
    proposals: [
      "POST /proposals",
      "GET /proposals",
      "PATCH /proposals/:id",
      "DELETE /proposals/:id?workspaceId=…&actorId=…",
    ],
    search: ["GET /search?workspaceId=&q=&initiativeId=&clusterId=&status=&from=&to="],
    health: ["GET /health"],
  },
  docs: "See docs/api.md for request/response shapes.",
};

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => API_INDEX);

  app.get("/health", async () => ({
    status: "ok",
    service: "marketing-os",
    time: new Date().toISOString(),
  }));
}
