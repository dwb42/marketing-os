import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { changeEventService } from "./change-event.service.js";
import { performanceService } from "./performance.service.js";
import { notFound } from "../lib/errors.js";
import { googleAdsConnector } from "../connectors/google-ads/index.js";
import type { StructurePullResult } from "../connectors/types.js";

// Syncs the structural state of a Google Ads campaign (ad groups, ads,
// keywords, campaign-level negatives) into the OS DB and emits ChangeEvents
// for any deltas against the previously known state.
//
// Idempotent: calling twice with identical upstream state produces zero
// ChangeEvents on the second call.

export type ChannelSubjectType =
  | "CHANNEL_AD_GROUP"
  | "CHANNEL_AD"
  | "CHANNEL_KEYWORD";

interface SyncArgs {
  workspaceId: string;
  channelCampaignId: string;
  actorId?: string;
  // Optional: allow injecting an already-pulled structure (testing).
  injectedPull?: StructurePullResult;
}

interface SyncResult {
  adGroupsTotal: number;
  adsTotal: number;
  keywordsTotal: number;
  negativesTotal: number;
  eventCount: number;
}

export class ChannelStructureService {
  async syncGoogleAdsCampaign(args: SyncArgs): Promise<SyncResult> {
    const cc = await prisma.channelCampaign.findFirst({
      where: { id: args.channelCampaignId, workspaceId: args.workspaceId },
      include: {
        channelConnection: { include: { integrationAccount: true } },
      },
    });
    if (!cc) throw notFound("ChannelCampaign", args.channelCampaignId);
    if (!cc.externalId) {
      throw new Error(
        `ChannelCampaign ${cc.id} has no externalId — cannot sync structure`,
      );
    }
    if (cc.channel !== "GOOGLE_ADS") {
      throw new Error(
        `Structure sync only supported for GOOGLE_ADS, got ${cc.channel}`,
      );
    }

    const ica = cc.channelConnection?.integrationAccount;
    if (!ica) {
      throw new Error(`ChannelCampaign ${cc.id} has no IntegrationAccount`);
    }
    const customerId = ica.externalId;

    let pulled: StructurePullResult;
    if (args.injectedPull) {
      pulled = args.injectedPull;
    } else {
      await googleAdsConnector.authenticate({
        id: ica.id,
        channel: "google_ads",
        externalId: customerId,
        credentialsEncrypted: JSON.stringify(ica.credentials),
      });
      pulled = await googleAdsConnector.pullStructure(customerId, cc.externalId);
    }

    const workspaceId = args.workspaceId;
    const channelCampaignId = cc.id;
    const now = new Date();
    let eventCount = 0;
    const append = async (
      subjectType: ChannelSubjectType,
      subjectId: string,
      kind: string,
      summary: string,
      payload: Record<string, unknown>,
    ) => {
      await changeEventService.append({
        workspaceId,
        subjectType,
        subjectId,
        actorId: args.actorId,
        kind,
        summary,
        payload,
      });
      eventCount += 1;
    };

    // ── Ad Groups ────────────────────────────────────────────────
    const existingAgs = await prisma.channelAdGroup.findMany({
      where: { channelCampaignId },
    });
    const existingAgByExternal = new Map(
      existingAgs.filter((a) => a.externalId).map((a) => [a.externalId!, a]),
    );
    const adGroupInternalIdByExternal = new Map<string, string>();

    const seenAgExternalIds = new Set<string>();
    for (const ag of pulled.adGroups) {
      seenAgExternalIds.add(ag.externalId);
      const existing = existingAgByExternal.get(ag.externalId);
      const bid = ag.cpcBidMicros ? BigInt(ag.cpcBidMicros) : null;

      if (!existing) {
        const id = newId("channelAdGroup");
        await prisma.channelAdGroup.create({
          data: {
            id,
            channelCampaignId,
            externalId: ag.externalId,
            name: ag.name,
            status: ag.status,
            cpcBidMicros: bid,
            lastSyncedAt: now,
          },
        });
        adGroupInternalIdByExternal.set(ag.externalId, id);
        await append(
          "CHANNEL_AD_GROUP",
          id,
          "channel_ad_group.added",
          `Ad Group "${ag.name}" aufgetaucht`,
          {
            externalId: ag.externalId,
            name: ag.name,
            status: ag.status,
            cpcBidMicros: ag.cpcBidMicros,
          },
        );
      } else {
        adGroupInternalIdByExternal.set(ag.externalId, existing.id);
        const updates: Record<string, unknown> = { lastSyncedAt: now };
        if (existing.name !== ag.name) {
          updates.name = ag.name;
          await append(
            "CHANNEL_AD_GROUP",
            existing.id,
            "channel_ad_group.renamed",
            `Ad Group umbenannt: "${existing.name}" → "${ag.name}"`,
            { from: existing.name, to: ag.name },
          );
        }
        if (existing.status !== ag.status) {
          updates.status = ag.status;
          await append(
            "CHANNEL_AD_GROUP",
            existing.id,
            "channel_ad_group.status_changed",
            `Ad Group "${existing.name}" ${existing.status} → ${ag.status}`,
            { from: existing.status, to: ag.status },
          );
        }
        const oldBid = existing.cpcBidMicros?.toString() ?? null;
        const newBid = bid?.toString() ?? null;
        if (oldBid !== newBid) {
          updates.cpcBidMicros = bid;
          await append(
            "CHANNEL_AD_GROUP",
            existing.id,
            "channel_ad_group.bid_changed",
            `Ad Group "${existing.name}" CPC-Gebot ${oldBid ?? "—"} → ${newBid ?? "—"}`,
            { fromMicros: oldBid, toMicros: newBid },
          );
        }
        await prisma.channelAdGroup.update({
          where: { id: existing.id },
          data: updates,
        });
      }
    }

    // AdGroups die upstream verschwunden sind → als REMOVED markieren.
    for (const ag of existingAgs) {
      if (ag.externalId && !seenAgExternalIds.has(ag.externalId)) {
        if (ag.status !== "REMOVED") {
          await prisma.channelAdGroup.update({
            where: { id: ag.id },
            data: { status: "REMOVED", lastSyncedAt: now },
          });
          await append(
            "CHANNEL_AD_GROUP",
            ag.id,
            "channel_ad_group.removed",
            `Ad Group "${ag.name}" entfernt`,
            { externalId: ag.externalId },
          );
        }
      }
    }

    // ── Ads ───────────────────────────────────────────────────────
    const existingAds = await prisma.channelAd.findMany({
      where: { channelAdGroup: { channelCampaignId } },
    });
    const existingAdByExternal = new Map(
      existingAds.filter((a) => a.externalId).map((a) => [a.externalId!, a]),
    );

    const seenAdExternalIds = new Set<string>();
    for (const ad of pulled.ads) {
      const internalAgId = adGroupInternalIdByExternal.get(ad.externalAdGroupId);
      if (!internalAgId) continue;
      seenAdExternalIds.add(ad.externalId);
      const existing = existingAdByExternal.get(ad.externalId);

      const newHeadlines = ad.headlines;
      const newDescriptions = ad.descriptions;
      const newFinalUrls = ad.finalUrls;

      if (!existing) {
        const id = newId("channelAd");
        await prisma.channelAd.create({
          data: {
            id,
            channelAdGroupId: internalAgId,
            externalId: ad.externalId,
            type: ad.type,
            status: ad.status,
            headlines: newHeadlines as object,
            descriptions: newDescriptions as object,
            finalUrls: newFinalUrls as object,
            path1: ad.path1,
            path2: ad.path2,
            policyApprovalStatus: ad.policyApprovalStatus,
            lastSyncedAt: now,
          },
        });
        await append(
          "CHANNEL_AD",
          id,
          "channel_ad.added",
          `RSA-Ad aufgetaucht (${newHeadlines.length} Headlines, ${newDescriptions.length} Descriptions)`,
          {
            externalId: ad.externalId,
            status: ad.status,
            headlineCount: newHeadlines.length,
            descriptionCount: newDescriptions.length,
          },
        );
      } else {
        const updates: Record<string, unknown> = { lastSyncedAt: now };

        if (existing.status !== ad.status) {
          updates.status = ad.status;
          await append(
            "CHANNEL_AD",
            existing.id,
            "channel_ad.status_changed",
            `Ad ${existing.status} → ${ad.status}`,
            { from: existing.status, to: ad.status },
          );
        }

        const oldApproval = existing.policyApprovalStatus ?? null;
        const newApproval = ad.policyApprovalStatus ?? null;
        if (oldApproval !== newApproval) {
          updates.policyApprovalStatus = newApproval;
          await append(
            "CHANNEL_AD",
            existing.id,
            "channel_ad.policy_changed",
            `Policy Approval ${oldApproval ?? "—"} → ${newApproval ?? "—"}`,
            { from: oldApproval, to: newApproval },
          );
        }

        const contentFields: Array<{
          key: "headlines" | "descriptions" | "finalUrls" | "path1" | "path2";
          oldVal: unknown;
          newVal: unknown;
        }> = [
          { key: "headlines", oldVal: existing.headlines, newVal: newHeadlines },
          { key: "descriptions", oldVal: existing.descriptions, newVal: newDescriptions },
          { key: "finalUrls", oldVal: existing.finalUrls, newVal: newFinalUrls },
          { key: "path1", oldVal: existing.path1, newVal: ad.path1 },
          { key: "path2", oldVal: existing.path2, newVal: ad.path2 },
        ];
        const changedContentKeys: string[] = [];
        for (const cf of contentFields) {
          if (JSON.stringify(cf.oldVal) !== JSON.stringify(cf.newVal)) {
            updates[cf.key] =
              typeof cf.newVal === "string" || cf.newVal == null
                ? (cf.newVal as string | null)
                : (cf.newVal as object);
            changedContentKeys.push(cf.key);
          }
        }
        if (changedContentKeys.length > 0) {
          await append(
            "CHANNEL_AD",
            existing.id,
            "channel_ad.content_changed",
            `Ad-Inhalte geändert: ${changedContentKeys.join(", ")}`,
            {
              fields: changedContentKeys,
              before: {
                headlines: existing.headlines,
                descriptions: existing.descriptions,
                finalUrls: existing.finalUrls,
                path1: existing.path1,
                path2: existing.path2,
              },
              after: {
                headlines: newHeadlines,
                descriptions: newDescriptions,
                finalUrls: newFinalUrls,
                path1: ad.path1,
                path2: ad.path2,
              },
            },
          );
        }

        await prisma.channelAd.update({
          where: { id: existing.id },
          data: updates,
        });
      }
    }

    for (const ad of existingAds) {
      if (ad.externalId && !seenAdExternalIds.has(ad.externalId)) {
        if (ad.status !== "REMOVED") {
          await prisma.channelAd.update({
            where: { id: ad.id },
            data: { status: "REMOVED", lastSyncedAt: now },
          });
          await append(
            "CHANNEL_AD",
            ad.id,
            "channel_ad.removed",
            `RSA-Ad entfernt`,
            { externalId: ad.externalId },
          );
        }
      }
    }

    // ── Keywords (inkl. Negatives) ───────────────────────────────
    const existingKws = await prisma.channelKeyword.findMany({
      where: {
        OR: [
          { channelAdGroup: { channelCampaignId } },
          { channelCampaignId },
        ],
      },
    });
    const existingKwByExternal = new Map(
      existingKws
        .filter((k) => k.externalId)
        .map((k) => [kwKey(k.channelAdGroupId, k.channelCampaignId, k.externalId!), k]),
    );

    const seenKwKeys = new Set<string>();
    let negativeCount = 0;
    for (const kw of pulled.keywords) {
      if (kw.negative && kw.externalCampaignId) negativeCount += 1;
      let internalAgId: string | null = null;
      if (kw.externalAdGroupId) {
        internalAgId =
          adGroupInternalIdByExternal.get(kw.externalAdGroupId) ?? null;
        if (!internalAgId) continue;
      }
      const parentKey = kwKey(
        internalAgId,
        kw.externalCampaignId ? channelCampaignId : null,
        kw.externalId,
      );
      seenKwKeys.add(parentKey);
      const existing = existingKwByExternal.get(parentKey);
      const bid = kw.cpcBidMicros ? BigInt(kw.cpcBidMicros) : null;
      const kwLabel = kw.negative
        ? `Negative "${kw.text}" [${kw.matchType}]`
        : `Keyword "${kw.text}" [${kw.matchType}]`;

      if (!existing) {
        const id = newId("channelKeyword");
        await prisma.channelKeyword.create({
          data: {
            id,
            channelAdGroupId: internalAgId,
            channelCampaignId: kw.externalCampaignId ? channelCampaignId : null,
            externalId: kw.externalId,
            text: kw.text,
            matchType: kw.matchType,
            negative: kw.negative,
            status: kw.status,
            cpcBidMicros: bid,
            lastSyncedAt: now,
          },
        });
        await append(
          "CHANNEL_KEYWORD",
          id,
          kw.negative ? "channel_keyword.negative_added" : "channel_keyword.added",
          `${kwLabel} hinzugefügt`,
          {
            text: kw.text,
            matchType: kw.matchType,
            negative: kw.negative,
            scope: kw.externalCampaignId ? "CAMPAIGN" : "AD_GROUP",
          },
        );
      } else {
        const updates: Record<string, unknown> = { lastSyncedAt: now };
        if (existing.status !== kw.status) {
          updates.status = kw.status;
          await append(
            "CHANNEL_KEYWORD",
            existing.id,
            "channel_keyword.status_changed",
            `${kwLabel} ${existing.status} → ${kw.status}`,
            { from: existing.status, to: kw.status },
          );
        }
        if (existing.matchType !== kw.matchType) {
          updates.matchType = kw.matchType;
          await append(
            "CHANNEL_KEYWORD",
            existing.id,
            "channel_keyword.match_type_changed",
            `${kwLabel} MatchType ${existing.matchType} → ${kw.matchType}`,
            { from: existing.matchType, to: kw.matchType },
          );
        }
        const oldBid = existing.cpcBidMicros?.toString() ?? null;
        const newBid = bid?.toString() ?? null;
        if (oldBid !== newBid) {
          updates.cpcBidMicros = bid;
          await append(
            "CHANNEL_KEYWORD",
            existing.id,
            "channel_keyword.bid_changed",
            `${kwLabel} Gebot ${oldBid ?? "—"} → ${newBid ?? "—"}`,
            { fromMicros: oldBid, toMicros: newBid },
          );
        }
        await prisma.channelKeyword.update({
          where: { id: existing.id },
          data: updates,
        });
      }
    }

    for (const kw of existingKws) {
      if (!kw.externalId) continue;
      const parentKey = kwKey(
        kw.channelAdGroupId,
        kw.channelCampaignId,
        kw.externalId,
      );
      if (!seenKwKeys.has(parentKey) && kw.status !== "REMOVED") {
        await prisma.channelKeyword.update({
          where: { id: kw.id },
          data: { status: "REMOVED", lastSyncedAt: now },
        });
        const label = kw.negative
          ? `Negative "${kw.text}" [${kw.matchType}]`
          : `Keyword "${kw.text}" [${kw.matchType}]`;
        await append(
          "CHANNEL_KEYWORD",
          kw.id,
          kw.negative ? "channel_keyword.negative_removed" : "channel_keyword.removed",
          `${label} entfernt`,
          { externalId: kw.externalId },
        );
      }
    }

    // Update ChannelCampaign.lastSyncedAt
    await prisma.channelCampaign.update({
      where: { id: channelCampaignId },
      data: { lastSyncedAt: now },
    });

    return {
      adGroupsTotal: pulled.adGroups.length,
      adsTotal: pulled.ads.length,
      keywordsTotal: pulled.keywords.length - negativeCount,
      negativesTotal: negativeCount,
      eventCount,
    };
  }

  // Pulls ad-group, keyword and ad-level performance for a given channel
  // campaign and upserts into the per-level performance tables. Expects the
  // structure sync to have run at least once so internal IDs exist.
  async syncGoogleAdsLevelPerformance(args: {
    workspaceId: string;
    channelCampaignId: string;
    from: Date;
    to: Date;
    syncRunId?: string;
  }): Promise<{ adGroupRows: number; keywordRows: number; adRows: number }> {
    const cc = await prisma.channelCampaign.findFirst({
      where: { id: args.channelCampaignId, workspaceId: args.workspaceId },
      include: { channelConnection: { include: { integrationAccount: true } } },
    });
    if (!cc) throw notFound("ChannelCampaign", args.channelCampaignId);
    if (!cc.externalId) {
      throw new Error(`ChannelCampaign ${cc.id} has no externalId`);
    }
    const ica = cc.channelConnection?.integrationAccount;
    if (!ica) throw new Error(`ChannelCampaign ${cc.id} has no IntegrationAccount`);

    await googleAdsConnector.authenticate({
      id: ica.id,
      channel: "google_ads",
      externalId: ica.externalId,
      credentialsEncrypted: JSON.stringify(ica.credentials),
    });
    const customerId = ica.externalId;

    // Resolve internal ids for our external-id keys.
    const adGroups = await prisma.channelAdGroup.findMany({
      where: { channelCampaignId: cc.id, externalId: { not: null } },
      select: { id: true, externalId: true },
    });
    const agInternalByExt = new Map(
      adGroups.map((a) => [a.externalId!, a.id]),
    );

    const ads = await prisma.channelAd.findMany({
      where: {
        channelAdGroup: { channelCampaignId: cc.id },
        externalId: { not: null },
      },
      select: { id: true, externalId: true },
    });
    const adInternalByExt = new Map(ads.map((a) => [a.externalId!, a.id]));

    const kws = await prisma.channelKeyword.findMany({
      where: {
        OR: [
          { channelAdGroup: { channelCampaignId: cc.id } },
          { channelCampaignId: cc.id },
        ],
        externalId: { not: null },
      },
      select: { id: true, externalId: true },
    });
    const kwInternalByExt = new Map(kws.map((k) => [k.externalId!, k.id]));

    const [agPerf, kwPerf, adPerf] = await Promise.all([
      googleAdsConnector.pullAdGroupPerformance(
        customerId,
        cc.externalId,
        args.from,
        args.to,
      ),
      googleAdsConnector.pullKeywordPerformance(
        customerId,
        cc.externalId,
        args.from,
        args.to,
      ),
      googleAdsConnector.pullAdPerformance(
        customerId,
        cc.externalId,
        args.from,
        args.to,
      ),
    ]);

    let adGroupRows = 0;
    for (const row of agPerf.rows) {
      const internalId = agInternalByExt.get(row.entityExternalId);
      if (!internalId) continue;
      await performanceService.upsertAdGroupDaily({
        channelAdGroupId: internalId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        costMicros: row.costMicros,
        conversions: row.conversions,
        conversionValue: row.conversionValue,
        raw: row.raw,
        syncRunId: args.syncRunId,
      });
      adGroupRows += 1;
    }

    let keywordRows = 0;
    for (const row of kwPerf.rows) {
      const internalId = kwInternalByExt.get(row.entityExternalId);
      if (!internalId) continue;
      await performanceService.upsertKeywordDaily({
        channelKeywordId: internalId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        costMicros: row.costMicros,
        conversions: row.conversions,
        conversionValue: row.conversionValue,
        raw: row.raw,
        syncRunId: args.syncRunId,
      });
      keywordRows += 1;
    }

    let adRows = 0;
    for (const row of adPerf.rows) {
      const internalId = adInternalByExt.get(row.entityExternalId);
      if (!internalId) continue;
      await performanceService.upsertAdDaily({
        channelAdId: internalId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        costMicros: row.costMicros,
        conversions: row.conversions,
        conversionValue: row.conversionValue,
        raw: row.raw,
        syncRunId: args.syncRunId,
      });
      adRows += 1;
    }

    return { adGroupRows, keywordRows, adRows };
  }
}

function kwKey(
  adGroupId: string | null,
  campaignId: string | null,
  externalId: string,
): string {
  return `${adGroupId ?? "-"}|${campaignId ?? "-"}|${externalId}`;
}

export const channelStructureService = new ChannelStructureService();
