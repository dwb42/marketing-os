import { logger } from "../lib/logger.js";
import { prisma } from "../services/prisma.js";
import { performanceService } from "../services/performance.service.js";
import { syncRunService } from "../services/sync-run.service.js";
import { getConnector } from "../connectors/registry.js";
import { yesterdayUtc } from "../lib/time.js";
import type { Job } from "./scheduler.js";

// Phase 3: Echter Pull. Phase 1: Struktur steht, Aufrufe sind sicher no-op.
export const dailyPerformancePull: Job = {
  id: "daily-performance-pull",
  description: "Zieht pro ChannelConnection die Performance des Vortags.",
  async run() {
    const yesterday = yesterdayUtc();
    const connections = await prisma.channelConnection.findMany({
      include: { integrationAccount: true, workspace: true },
    });

    for (const conn of connections) {
      const connector = getConnector(
        conn.integrationAccount.channel === "GOOGLE_ADS" ? "google_ads" : "meta_ads",
      );
      const idempotencyKey = `pull:${conn.id}:${yesterday.toISOString().slice(0, 10)}`;
      const { id: syncRunId, reused } = await syncRunService.createOrGet({
        workspaceId: conn.workspaceId,
        channel: conn.integrationAccount.channel === "GOOGLE_ADS" ? "GOOGLE_ADS" : "META_ADS",
        type: "PULL_PERFORMANCE",
        targetType: "CHANNEL_CONNECTION",
        targetId: conn.id,
        idempotencyKey,
        input: { from: yesterday, to: yesterday },
      });
      if (reused) {
        logger.info({ syncRunId }, "sync run already exists, skipping");
        continue;
      }

      try {
        await syncRunService.markRunning(syncRunId);
        const handle = await connector.authenticate({
          id: conn.integrationAccount.id,
          channel: connector.id,
          externalId: conn.integrationAccount.externalId,
          credentialsEncrypted: JSON.stringify(conn.integrationAccount.credentials),
        });

        const result = await connector.pullPerformance({
          connection: handle,
          from: yesterday,
          to: yesterday,
        });

        for (const row of result.rows) {
          const cc = await prisma.channelCampaign.findFirst({
            where: {
              channel: connector.id === "google_ads" ? "GOOGLE_ADS" : "META_ADS",
              externalId: row.externalCampaignId,
            },
          });
          if (!cc) continue;
          await performanceService.upsertDaily({
            channelCampaignId: cc.id,
            date: row.date,
            impressions: row.impressions,
            clicks: row.clicks,
            costMicros: row.costMicros,
            conversions: row.conversions,
            conversionValue: row.conversionValue,
            raw: row.raw,
            syncRunId,
          });
        }

        await syncRunService.markSucceeded(syncRunId, { rowCount: result.rows.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const kind = (err as { kind?: string })?.kind ?? "UNKNOWN";
        await syncRunService.markFailed(syncRunId, kind, message);
        logger.error({ syncRunId, err: message }, "pull failed");
      }
    }
  },
};
