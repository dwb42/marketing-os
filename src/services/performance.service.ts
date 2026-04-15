import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";

export interface PerformanceSnapshotInput {
  channelCampaignId: string;
  date: Date;
  impressions: number;
  clicks: number;
  costMicros: bigint;
  conversions: number;
  conversionValue: number;
  raw: Record<string, unknown>;
  syncRunId?: string;
}

export class PerformanceService {
  async upsertDaily(input: PerformanceSnapshotInput): Promise<void> {
    await prisma.performanceSnapshotDaily.upsert({
      where: {
        channelCampaignId_date: {
          channelCampaignId: input.channelCampaignId,
          date: input.date,
        },
      },
      create: {
        id: newId("performance"),
        channelCampaignId: input.channelCampaignId,
        date: input.date,
        impressions: input.impressions,
        clicks: input.clicks,
        costMicros: input.costMicros,
        conversions: input.conversions,
        conversionValue: input.conversionValue,
        raw: input.raw as object,
        syncRunId: input.syncRunId ?? null,
      },
      update: {
        impressions: input.impressions,
        clicks: input.clicks,
        costMicros: input.costMicros,
        conversions: input.conversions,
        conversionValue: input.conversionValue,
        raw: input.raw as object,
        pulledAt: new Date(),
        syncRunId: input.syncRunId ?? null,
      },
    });
  }

  async query(channelCampaignId: string, from: Date, to: Date) {
    return prisma.performanceSnapshotDaily.findMany({
      where: { channelCampaignId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  }
}

export const performanceService = new PerformanceService();
