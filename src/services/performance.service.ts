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

  async upsertAdGroupDaily(input: {
    channelAdGroupId: string;
    date: Date;
    impressions: number;
    clicks: number;
    costMicros: bigint;
    conversions: number;
    conversionValue: number;
    raw: Record<string, unknown>;
    syncRunId?: string;
  }): Promise<void> {
    await prisma.adGroupPerformanceDaily.upsert({
      where: {
        channelAdGroupId_date: {
          channelAdGroupId: input.channelAdGroupId,
          date: input.date,
        },
      },
      create: {
        id: newId("adGroupPerformance"),
        channelAdGroupId: input.channelAdGroupId,
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

  async upsertKeywordDaily(input: {
    channelKeywordId: string;
    date: Date;
    impressions: number;
    clicks: number;
    costMicros: bigint;
    conversions: number;
    conversionValue: number;
    raw: Record<string, unknown>;
    syncRunId?: string;
  }): Promise<void> {
    await prisma.keywordPerformanceDaily.upsert({
      where: {
        channelKeywordId_date: {
          channelKeywordId: input.channelKeywordId,
          date: input.date,
        },
      },
      create: {
        id: newId("keywordPerformance"),
        channelKeywordId: input.channelKeywordId,
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

  async upsertAdDaily(input: {
    channelAdId: string;
    date: Date;
    impressions: number;
    clicks: number;
    costMicros: bigint;
    conversions: number;
    conversionValue: number;
    raw: Record<string, unknown>;
    syncRunId?: string;
  }): Promise<void> {
    await prisma.adPerformanceDaily.upsert({
      where: {
        channelAdId_date: {
          channelAdId: input.channelAdId,
          date: input.date,
        },
      },
      create: {
        id: newId("adPerformance"),
        channelAdId: input.channelAdId,
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

  async queryAdGroup(channelAdGroupId: string, from: Date, to: Date) {
    return prisma.adGroupPerformanceDaily.findMany({
      where: { channelAdGroupId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  }

  async queryKeyword(channelKeywordId: string, from: Date, to: Date) {
    return prisma.keywordPerformanceDaily.findMany({
      where: { channelKeywordId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  }

  async queryAd(channelAdId: string, from: Date, to: Date) {
    return prisma.adPerformanceDaily.findMany({
      where: { channelAdId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  }
}

export const performanceService = new PerformanceService();
