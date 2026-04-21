import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
import { googleAdsConnector } from "../connectors/google-ads/index.js";
import { changeEventService } from "./change-event.service.js";
import { syncRunService } from "./sync-run.service.js";

// Single service for all "push an edit to Google Ads and reflect it locally"
// operations. Every method:
//   1. Loads the internal entity + its external id.
//   2. Authenticates once against Google Ads via the existing IntegrationAccount.
//   3. Calls the connector mutation.
//   4. Updates the local row immediately (so the UI reflects the new state
//      without waiting for a structure-sync).
//   5. Writes a SyncRun (PUSH_CAMPAIGN) + a ChangeEvent with before/after.
//
// The *next* structure-sync will reconcile any drift (e.g. Google Ads rejected
// a pause, or policy status changed) and emit its own ChangeEvents.

type AdStatus = "ENABLED" | "PAUSED";
type MatchType = "EXACT" | "PHRASE" | "BROAD";

async function authForChannelCampaign(ccId: string) {
  const cc = await prisma.channelCampaign.findUnique({
    where: { id: ccId },
    include: { channelConnection: { include: { integrationAccount: true } } },
  });
  if (!cc) throw notFound("ChannelCampaign", ccId);
  if (cc.channel !== "GOOGLE_ADS") {
    throw invalidState(`ChannelCampaign ${ccId} channel is ${cc.channel}, mutations only support GOOGLE_ADS`);
  }
  if (!cc.externalId) {
    throw invalidState(`ChannelCampaign ${ccId} has no externalId — cannot mutate external state`);
  }
  const ica = cc.channelConnection?.integrationAccount;
  if (!ica) throw invalidState(`ChannelCampaign ${ccId} has no IntegrationAccount`);

  await googleAdsConnector.authenticate({
    id: ica.id,
    channel: "google_ads",
    externalId: ica.externalId,
    credentialsEncrypted: JSON.stringify(ica.credentials),
  });
  return { cc, customerId: ica.externalId };
}

async function makeRun(params: {
  workspaceId: string;
  targetType: "CAMPAIGN" | "CHANNEL_CAMPAIGN" | "CHANNEL_AD_GROUP" | "CHANNEL_AD" | "CHANNEL_KEYWORD";
  targetId: string;
  kind: string;
  input: Record<string, unknown>;
}) {
  const idempotencyKey = `mutate:${params.kind}:${params.targetId}:${Date.now()}`;
  const { id: syncRunId } = await syncRunService.createOrGet({
    workspaceId: params.workspaceId,
    channel: "GOOGLE_ADS",
    type: "PUSH_CAMPAIGN",
    targetType: params.targetType,
    targetId: params.targetId,
    idempotencyKey,
    input: { kind: params.kind, ...params.input },
  });
  await syncRunService.markRunning(syncRunId);
  return syncRunId;
}

export class ChannelMutationService {
  // ── ChannelCampaign ──────────────────────────────────────────────

  async setCampaignStatus(params: {
    workspaceId: string;
    channelCampaignId: string;
    status: AdStatus;
    actorId?: string;
    reason?: string;
  }) {
    const { cc, customerId } = await authForChannelCampaign(params.channelCampaignId);
    if (cc.workspaceId !== params.workspaceId) throw notFound("ChannelCampaign", params.channelCampaignId);

    const before = cc.status;
    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_CAMPAIGN",
      targetId: cc.id,
      kind: "channel_campaign.set_status",
      input: { to: params.status },
    });
    try {
      await googleAdsConnector.mutateCampaignStatus(customerId, cc.externalId!, params.status);
      await prisma.channelCampaign.update({
        where: { id: cc.id },
        data: { status: params.status === "ENABLED" ? "SYNCED" : "PAUSED" },
      });
      await syncRunService.markSucceeded(syncRunId, { before, after: params.status });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_CAMPAIGN",
        subjectId: cc.id,
        actorId: params.actorId,
        kind: "channel_campaign.status_pushed",
        summary: `Campaign external status ${before} → ${params.status}`,
        payload: { before, after: params.status, reason: params.reason ?? null },
      });
      return { ok: true, syncRunId, before, after: params.status };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async updateCampaignBudget(params: {
    workspaceId: string;
    channelCampaignId: string;
    amountMicros: bigint;
    actorId?: string;
    reason?: string;
  }) {
    const { cc, customerId } = await authForChannelCampaign(params.channelCampaignId);
    if (cc.workspaceId !== params.workspaceId) throw notFound("ChannelCampaign", params.channelCampaignId);

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_CAMPAIGN",
      targetId: cc.id,
      kind: "channel_campaign.update_budget",
      input: { amountMicros: params.amountMicros.toString() },
    });
    try {
      const budgetResource = await googleAdsConnector.getCampaignBudgetResource(
        customerId,
        cc.externalId!,
      );
      await googleAdsConnector.updateCampaignBudget(customerId, budgetResource, params.amountMicros);
      await syncRunService.markSucceeded(syncRunId, {
        budgetResource,
        amountMicros: params.amountMicros.toString(),
      });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_CAMPAIGN",
        subjectId: cc.id,
        actorId: params.actorId,
        kind: "channel_campaign.budget_updated",
        summary: `Budget → ${(Number(params.amountMicros) / 1_000_000).toFixed(2)} €/Tag`,
        payload: {
          budgetResource,
          amountMicros: params.amountMicros.toString(),
          reason: params.reason ?? null,
        },
      });
      return { ok: true, syncRunId, budgetResource };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async addCampaignNegativeKeywords(params: {
    workspaceId: string;
    channelCampaignId: string;
    keywords: Array<{ text: string; matchType: MatchType }>;
    actorId?: string;
    reason?: string;
  }) {
    if (params.keywords.length === 0) throw invalidInput("keywords must be non-empty");
    const { cc, customerId } = await authForChannelCampaign(params.channelCampaignId);
    if (cc.workspaceId !== params.workspaceId) throw notFound("ChannelCampaign", params.channelCampaignId);

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_CAMPAIGN",
      targetId: cc.id,
      kind: "channel_campaign.add_negatives",
      input: { count: params.keywords.length },
    });
    try {
      const added = await googleAdsConnector.addCampaignNegativeKeywords(
        customerId,
        cc.externalId!,
        params.keywords,
      );

      const createdIds: string[] = [];
      for (const r of added) {
        const inputKw = params.keywords.find((k) => k.text === r.text)!;
        const id = newId("channelKeyword");
        await prisma.channelKeyword.create({
          data: {
            id,
            channelCampaignId: cc.id,
            channelAdGroupId: null,
            externalId: r.externalId,
            text: r.text,
            matchType: inputKw.matchType,
            negative: true,
            status: "ENABLED",
            cpcBidMicros: null,
            lastSyncedAt: new Date(),
          },
        });
        createdIds.push(id);
        await changeEventService.append({
          workspaceId: params.workspaceId,
          subjectType: "CHANNEL_KEYWORD",
          subjectId: id,
          actorId: params.actorId,
          kind: "channel_keyword.negative_added",
          summary: `Campaign-Negative "${r.text}" [${inputKw.matchType}] hinzugefügt`,
          payload: {
            externalId: r.externalId,
            text: r.text,
            matchType: inputKw.matchType,
            scope: "CAMPAIGN",
            reason: params.reason ?? null,
          },
        });
      }

      await syncRunService.markSucceeded(syncRunId, {
        added: added.map((a) => ({ externalId: a.externalId, text: a.text })),
      });
      return { ok: true, syncRunId, createdIds };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  // ── ChannelAdGroup ───────────────────────────────────────────────

  async setAdGroupStatus(params: {
    workspaceId: string;
    channelAdGroupId: string;
    status: AdStatus;
    actorId?: string;
    reason?: string;
  }) {
    const ag = await prisma.channelAdGroup.findFirst({
      where: {
        id: params.channelAdGroupId,
        channelCampaign: { workspaceId: params.workspaceId },
      },
      include: { channelCampaign: true },
    });
    if (!ag) throw notFound("ChannelAdGroup", params.channelAdGroupId);
    if (!ag.externalId) throw invalidState(`ChannelAdGroup ${ag.id} has no externalId`);
    const { customerId } = await authForChannelCampaign(ag.channelCampaignId);

    const before = ag.status;
    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD_GROUP",
      targetId: ag.id,
      kind: "channel_ad_group.set_status",
      input: { to: params.status },
    });
    try {
      await googleAdsConnector.mutateAdGroupStatus(customerId, ag.externalId, params.status);
      await prisma.channelAdGroup.update({ where: { id: ag.id }, data: { status: params.status } });
      await syncRunService.markSucceeded(syncRunId, { before, after: params.status });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_AD_GROUP",
        subjectId: ag.id,
        actorId: params.actorId,
        kind: "channel_ad_group.status_pushed",
        summary: `Ad Group "${ag.name}" external status ${before} → ${params.status}`,
        payload: { before, after: params.status, reason: params.reason ?? null },
      });
      return { ok: true, syncRunId, before, after: params.status };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async updateAdGroupBid(params: {
    workspaceId: string;
    channelAdGroupId: string;
    cpcBidMicros: bigint;
    actorId?: string;
    reason?: string;
  }) {
    const ag = await prisma.channelAdGroup.findFirst({
      where: {
        id: params.channelAdGroupId,
        channelCampaign: { workspaceId: params.workspaceId },
      },
    });
    if (!ag) throw notFound("ChannelAdGroup", params.channelAdGroupId);
    if (!ag.externalId) throw invalidState(`ChannelAdGroup ${ag.id} has no externalId`);
    const { customerId } = await authForChannelCampaign(ag.channelCampaignId);

    const before = ag.cpcBidMicros?.toString() ?? null;
    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD_GROUP",
      targetId: ag.id,
      kind: "channel_ad_group.update_bid",
      input: { cpcBidMicros: params.cpcBidMicros.toString() },
    });
    try {
      await googleAdsConnector.updateAdGroupBid(customerId, ag.externalId, params.cpcBidMicros);
      await prisma.channelAdGroup.update({
        where: { id: ag.id },
        data: { cpcBidMicros: params.cpcBidMicros },
      });
      await syncRunService.markSucceeded(syncRunId, { before, after: params.cpcBidMicros.toString() });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_AD_GROUP",
        subjectId: ag.id,
        actorId: params.actorId,
        kind: "channel_ad_group.bid_pushed",
        summary: `Ad Group "${ag.name}" CPC ${before ?? "—"} → ${params.cpcBidMicros.toString()}`,
        payload: { before, after: params.cpcBidMicros.toString(), reason: params.reason ?? null },
      });
      return { ok: true, syncRunId };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async addKeywords(params: {
    workspaceId: string;
    channelAdGroupId: string;
    keywords: Array<{
      text: string;
      matchType: MatchType;
      cpcBidMicros?: bigint;
      negative?: boolean;
    }>;
    addHealthPolicyExemption?: boolean;
    actorId?: string;
    reason?: string;
  }) {
    if (params.keywords.length === 0) throw invalidInput("keywords must be non-empty");
    const ag = await prisma.channelAdGroup.findFirst({
      where: {
        id: params.channelAdGroupId,
        channelCampaign: { workspaceId: params.workspaceId },
      },
    });
    if (!ag) throw notFound("ChannelAdGroup", params.channelAdGroupId);
    if (!ag.externalId) throw invalidState(`ChannelAdGroup ${ag.id} has no externalId`);
    const { customerId } = await authForChannelCampaign(ag.channelCampaignId);

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD_GROUP",
      targetId: ag.id,
      kind: "channel_ad_group.add_keywords",
      input: { count: params.keywords.length },
    });
    try {
      const added = await googleAdsConnector.addAdGroupKeywords(
        customerId,
        ag.externalId,
        params.keywords,
        { addHealthPolicyExemption: params.addHealthPolicyExemption ?? false },
      );

      const createdIds: string[] = [];
      for (const r of added) {
        const inputKw = params.keywords.find((k) => k.text === r.text)!;
        const id = newId("channelKeyword");
        await prisma.channelKeyword.create({
          data: {
            id,
            channelAdGroupId: ag.id,
            channelCampaignId: null,
            externalId: r.externalId,
            text: r.text,
            matchType: inputKw.matchType,
            negative: inputKw.negative ?? false,
            status: "ENABLED",
            cpcBidMicros: inputKw.cpcBidMicros ?? null,
            lastSyncedAt: new Date(),
          },
        });
        createdIds.push(id);
        await changeEventService.append({
          workspaceId: params.workspaceId,
          subjectType: "CHANNEL_KEYWORD",
          subjectId: id,
          actorId: params.actorId,
          kind: inputKw.negative ? "channel_keyword.negative_added" : "channel_keyword.added",
          summary: `${inputKw.negative ? "Negative" : "Keyword"} "${r.text}" [${inputKw.matchType}] hinzugefügt`,
          payload: {
            externalId: r.externalId,
            text: r.text,
            matchType: inputKw.matchType,
            negative: inputKw.negative ?? false,
            scope: "AD_GROUP",
            reason: params.reason ?? null,
          },
        });
      }

      await syncRunService.markSucceeded(syncRunId, {
        added: added.map((a) => ({ externalId: a.externalId, text: a.text })),
      });
      return { ok: true, syncRunId, createdIds };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async addResponsiveSearchAd(params: {
    workspaceId: string;
    channelAdGroupId: string;
    content: {
      headlines: string[];
      descriptions: string[];
      finalUrls: string[];
      path1?: string | null;
      path2?: string | null;
    };
    paused?: boolean;
    actorId?: string;
    reason?: string;
  }) {
    const ag = await prisma.channelAdGroup.findFirst({
      where: {
        id: params.channelAdGroupId,
        channelCampaign: { workspaceId: params.workspaceId },
      },
    });
    if (!ag) throw notFound("ChannelAdGroup", params.channelAdGroupId);
    if (!ag.externalId) throw invalidState(`ChannelAdGroup ${ag.id} has no externalId`);
    const { customerId } = await authForChannelCampaign(ag.channelCampaignId);

    if (params.content.headlines.length < 3) {
      throw invalidInput("RSA requires at least 3 headlines");
    }
    if (params.content.descriptions.length < 2) {
      throw invalidInput("RSA requires at least 2 descriptions");
    }

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD_GROUP",
      targetId: ag.id,
      kind: "channel_ad_group.add_ad",
      input: {
        headlines: params.content.headlines.length,
        descriptions: params.content.descriptions.length,
      },
    });
    try {
      const { externalId } = await googleAdsConnector.addResponsiveSearchAd(
        customerId,
        ag.externalId,
        params.content,
        { status: params.paused ? "PAUSED" : "ENABLED" },
      );

      const id = newId("channelAd");
      const status = params.paused ? "PAUSED" : "ENABLED";
      await prisma.channelAd.create({
        data: {
          id,
          channelAdGroupId: ag.id,
          externalId,
          type: "RESPONSIVE_SEARCH_AD",
          status,
          headlines: params.content.headlines.map((text) => ({ text, pinnedField: null })) as object,
          descriptions: params.content.descriptions.map((text) => ({ text, pinnedField: null })) as object,
          finalUrls: params.content.finalUrls as object,
          path1: params.content.path1 ?? null,
          path2: params.content.path2 ?? null,
          policyApprovalStatus: null,
          lastSyncedAt: new Date(),
        },
      });

      await syncRunService.markSucceeded(syncRunId, { externalId });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_AD",
        subjectId: id,
        actorId: params.actorId,
        kind: "channel_ad.added",
        summary: `RSA-Ad erstellt (${params.content.headlines.length} Headlines, ${params.content.descriptions.length} Descriptions, status=${status})`,
        payload: {
          externalId,
          headlineCount: params.content.headlines.length,
          descriptionCount: params.content.descriptions.length,
          status,
          reason: params.reason ?? null,
        },
      });
      return { ok: true, syncRunId, channelAdId: id, externalId };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  // ── ChannelAd ────────────────────────────────────────────────────

  async setAdStatus(params: {
    workspaceId: string;
    channelAdId: string;
    status: AdStatus;
    actorId?: string;
    reason?: string;
  }) {
    const ad = await prisma.channelAd.findFirst({
      where: {
        id: params.channelAdId,
        channelAdGroup: { channelCampaign: { workspaceId: params.workspaceId } },
      },
      include: { channelAdGroup: true },
    });
    if (!ad) throw notFound("ChannelAd", params.channelAdId);
    if (!ad.externalId) throw invalidState(`ChannelAd ${ad.id} has no externalId`);
    if (!ad.channelAdGroup.externalId) {
      throw invalidState(`Parent ChannelAdGroup has no externalId`);
    }
    const { customerId } = await authForChannelCampaign(ad.channelAdGroup.channelCampaignId);

    const before = ad.status;
    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD",
      targetId: ad.id,
      kind: "channel_ad.set_status",
      input: { to: params.status },
    });
    try {
      await googleAdsConnector.mutateAdGroupAdStatus(
        customerId,
        ad.channelAdGroup.externalId,
        ad.externalId,
        params.status,
      );
      await prisma.channelAd.update({ where: { id: ad.id }, data: { status: params.status } });
      await syncRunService.markSucceeded(syncRunId, { before, after: params.status });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_AD",
        subjectId: ad.id,
        actorId: params.actorId,
        kind: "channel_ad.status_pushed",
        summary: `RSA-Ad external status ${before} → ${params.status}`,
        payload: { before, after: params.status, reason: params.reason ?? null },
      });
      return { ok: true, syncRunId, before, after: params.status };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async updateAdContent(params: {
    workspaceId: string;
    channelAdId: string;
    patch: {
      headlines?: Array<{ text: string; pinnedField?: string | null }>;
      descriptions?: Array<{ text: string; pinnedField?: string | null }>;
      path1?: string | null;
      path2?: string | null;
      finalUrls?: string[];
    };
    actorId?: string;
    reason?: string;
  }) {
    const ad = await prisma.channelAd.findFirst({
      where: {
        id: params.channelAdId,
        channelAdGroup: { channelCampaign: { workspaceId: params.workspaceId } },
      },
      include: { channelAdGroup: true },
    });
    if (!ad) throw notFound("ChannelAd", params.channelAdId);
    if (!ad.externalId) throw invalidState(`ChannelAd ${ad.id} has no externalId`);
    if (!ad.channelAdGroup.externalId) {
      throw invalidState(`Parent ChannelAdGroup has no externalId`);
    }
    const touched = Object.keys(params.patch).filter((k) =>
      (params.patch as Record<string, unknown>)[k] !== undefined,
    );
    if (touched.length === 0) throw invalidInput("patch body must contain at least one field");

    const { customerId } = await authForChannelCampaign(ad.channelAdGroup.channelCampaignId);
    const before = {
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      path1: ad.path1,
      path2: ad.path2,
      finalUrls: ad.finalUrls,
    };

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_AD",
      targetId: ad.id,
      kind: "channel_ad.update_content",
      input: { fields: touched },
    });
    try {
      await googleAdsConnector.updateResponsiveSearchAd(
        customerId,
        ad.channelAdGroup.externalId,
        ad.externalId,
        params.patch,
      );

      const updateData: Record<string, unknown> = { lastSyncedAt: new Date() };
      if (params.patch.headlines !== undefined) updateData.headlines = params.patch.headlines as object;
      if (params.patch.descriptions !== undefined)
        updateData.descriptions = params.patch.descriptions as object;
      if (params.patch.path1 !== undefined) updateData.path1 = params.patch.path1;
      if (params.patch.path2 !== undefined) updateData.path2 = params.patch.path2;
      if (params.patch.finalUrls !== undefined) updateData.finalUrls = params.patch.finalUrls as object;

      const updated = await prisma.channelAd.update({ where: { id: ad.id }, data: updateData });
      const after = {
        headlines: updated.headlines,
        descriptions: updated.descriptions,
        path1: updated.path1,
        path2: updated.path2,
        finalUrls: updated.finalUrls,
      };

      await syncRunService.markSucceeded(syncRunId, { fields: touched });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_AD",
        subjectId: ad.id,
        actorId: params.actorId,
        kind: "channel_ad.content_pushed",
        summary: `RSA-Inhalt gepusht: ${touched.join(", ")}`,
        payload: { fields: touched, before, after, reason: params.reason ?? null },
      });
      return { ok: true, syncRunId, fields: touched };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  // ── ChannelKeyword ───────────────────────────────────────────────

  async setKeywordStatus(params: {
    workspaceId: string;
    channelKeywordId: string;
    status: AdStatus;
    actorId?: string;
    reason?: string;
  }) {
    const kw = await prisma.channelKeyword.findFirst({
      where: {
        id: params.channelKeywordId,
        OR: [
          { channelAdGroup: { channelCampaign: { workspaceId: params.workspaceId } } },
          { channelCampaign: { workspaceId: params.workspaceId } },
        ],
      },
      include: { channelAdGroup: true, channelCampaign: true },
    });
    if (!kw) throw notFound("ChannelKeyword", params.channelKeywordId);
    if (!kw.externalId) throw invalidState(`ChannelKeyword ${kw.id} has no externalId`);
    const ccId = kw.channelAdGroup?.channelCampaignId ?? kw.channelCampaignId!;
    const { customerId, cc } = await authForChannelCampaign(ccId);

    const before = kw.status;
    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_KEYWORD",
      targetId: kw.id,
      kind: "channel_keyword.set_status",
      input: { to: params.status },
    });
    try {
      if (kw.channelAdGroup) {
        if (!kw.channelAdGroup.externalId) {
          throw invalidState(`Parent ChannelAdGroup has no externalId`);
        }
        await googleAdsConnector.mutateAdGroupCriterionStatus(
          customerId,
          kw.channelAdGroup.externalId,
          kw.externalId,
          params.status,
        );
      } else {
        await googleAdsConnector.mutateCampaignCriterionStatus(
          customerId,
          cc.externalId!,
          kw.externalId,
          params.status,
        );
      }
      await prisma.channelKeyword.update({ where: { id: kw.id }, data: { status: params.status } });
      await syncRunService.markSucceeded(syncRunId, { before, after: params.status });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_KEYWORD",
        subjectId: kw.id,
        actorId: params.actorId,
        kind: "channel_keyword.status_pushed",
        summary: `${kw.negative ? "Negative" : "Keyword"} "${kw.text}" external status ${before} → ${params.status}`,
        payload: { before, after: params.status, reason: params.reason ?? null },
      });
      return { ok: true, syncRunId, before, after: params.status };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }

  async removeKeyword(params: {
    workspaceId: string;
    channelKeywordId: string;
    actorId?: string;
    reason?: string;
  }) {
    const kw = await prisma.channelKeyword.findFirst({
      where: {
        id: params.channelKeywordId,
        OR: [
          { channelAdGroup: { channelCampaign: { workspaceId: params.workspaceId } } },
          { channelCampaign: { workspaceId: params.workspaceId } },
        ],
      },
      include: { channelAdGroup: true, channelCampaign: true },
    });
    if (!kw) throw notFound("ChannelKeyword", params.channelKeywordId);
    if (!kw.externalId) throw invalidState(`ChannelKeyword ${kw.id} has no externalId`);
    const ccId = kw.channelAdGroup?.channelCampaignId ?? kw.channelCampaignId!;
    const { customerId, cc } = await authForChannelCampaign(ccId);

    const syncRunId = await makeRun({
      workspaceId: params.workspaceId,
      targetType: "CHANNEL_KEYWORD",
      targetId: kw.id,
      kind: "channel_keyword.remove",
      input: { text: kw.text, matchType: kw.matchType, scope: kw.channelAdGroupId ? "AD_GROUP" : "CAMPAIGN" },
    });
    try {
      if (kw.channelAdGroup) {
        if (!kw.channelAdGroup.externalId) {
          throw invalidState(`Parent ChannelAdGroup has no externalId`);
        }
        await googleAdsConnector.removeAdGroupCriterion(
          customerId,
          kw.channelAdGroup.externalId,
          kw.externalId,
        );
      } else {
        await googleAdsConnector.removeCampaignCriterion(
          customerId,
          cc.externalId!,
          kw.externalId,
        );
      }
      // Preserve performance history: mark REMOVED locally instead of hard
      // deleting. KeywordPerformanceDaily rows stay.
      await prisma.channelKeyword.update({
        where: { id: kw.id },
        data: { status: "REMOVED", lastSyncedAt: new Date() },
      });
      await syncRunService.markSucceeded(syncRunId, { externalId: kw.externalId });
      await changeEventService.append({
        workspaceId: params.workspaceId,
        subjectType: "CHANNEL_KEYWORD",
        subjectId: kw.id,
        actorId: params.actorId,
        kind: kw.negative ? "channel_keyword.negative_removed" : "channel_keyword.removed",
        summary: `${kw.negative ? "Negative" : "Keyword"} "${kw.text}" [${kw.matchType}] entfernt`,
        payload: {
          externalId: kw.externalId,
          text: kw.text,
          matchType: kw.matchType,
          reason: params.reason ?? null,
        },
      });
      return { ok: true, syncRunId };
    } catch (err) {
      await failRun(syncRunId, err);
      throw err;
    }
  }
}

async function failRun(syncRunId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const kind = (err as { kind?: string })?.kind ?? "UNKNOWN";
  await syncRunService.markFailed(syncRunId, kind, message);
}

export const channelMutationService = new ChannelMutationService();
