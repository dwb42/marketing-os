import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../services/prisma.js";
import { performanceService } from "../../services/performance.service.js";
import { channelStructureService } from "../../services/channel-structure.service.js";
import { syncRunService } from "../../services/sync-run.service.js";
import { outcomeService } from "../../services/outcome.service.js";
import { googleAdsConnector } from "../../connectors/google-ads/index.js";
import { changeEventService } from "../../services/change-event.service.js";
import { DomainError } from "../../lib/errors.js";
import { WorkspaceIdSchema } from "../schemas.js";
import { startOfUtcDay, yesterdayUtc, daysAgoUtc } from "../../lib/time.js";

// Serialises BigInt-carrying rows for JSON over-the-wire.
function serializeBigInt<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out as T;
}

export async function registerStructureRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /campaigns/:id/structure ───────────────────────────────
  // Liefert die vollständige externe Struktur (pro ChannelCampaign):
  // Ad Groups mit Ads und Keywords, plus campaign-level Negatives.
  app.get("/campaigns/:id/structure", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);

    const campaign = await prisma.campaign.findFirst({
      where: { id: p.id, workspaceId: q.workspaceId },
    });
    if (!campaign) throw new DomainError("NOT_FOUND", `Campaign ${p.id} not found`);

    const channelCampaigns = await prisma.channelCampaign.findMany({
      where: { campaignId: p.id, workspaceId: q.workspaceId },
      include: {
        adGroups: {
          include: {
            ads: true,
            keywords: true,
          },
          orderBy: { createdAt: "asc" },
        },
        negatives: true,
      },
    });

    return channelCampaigns.map((cc) => ({
      id: cc.id,
      channel: cc.channel,
      externalId: cc.externalId,
      externalName: cc.externalName,
      status: cc.status,
      lastSyncedAt: cc.lastSyncedAt,
      adGroups: cc.adGroups.map((ag) => ({
        id: ag.id,
        externalId: ag.externalId,
        name: ag.name,
        status: ag.status,
        cpcBidMicros: ag.cpcBidMicros?.toString() ?? null,
        lastSyncedAt: ag.lastSyncedAt,
        ads: ag.ads.map((ad) => ({
          id: ad.id,
          externalId: ad.externalId,
          type: ad.type,
          status: ad.status,
          policyApprovalStatus: ad.policyApprovalStatus,
          headlines: ad.headlines,
          descriptions: ad.descriptions,
          finalUrls: ad.finalUrls,
          path1: ad.path1,
          path2: ad.path2,
          lastSyncedAt: ad.lastSyncedAt,
        })),
        keywords: ag.keywords.map((kw) => ({
          id: kw.id,
          externalId: kw.externalId,
          text: kw.text,
          matchType: kw.matchType,
          negative: kw.negative,
          status: kw.status,
          cpcBidMicros: kw.cpcBidMicros?.toString() ?? null,
          lastSyncedAt: kw.lastSyncedAt,
        })),
      })),
      negatives: cc.negatives.map((kw) => ({
        id: kw.id,
        externalId: kw.externalId,
        text: kw.text,
        matchType: kw.matchType,
        status: kw.status,
        lastSyncedAt: kw.lastSyncedAt,
      })),
    }));
  });

  // ── POST /campaigns/:id/structure/sync ─────────────────────────
  // Pullt Struktur + Per-Level-Performance. Emittiert ChangeEvents
  // für jede Delta gegenüber vorherigem State.
  app.post("/campaigns/:id/structure/sync", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        actorId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.body);

    const channelCampaigns = await prisma.channelCampaign.findMany({
      where: { campaignId: p.id, workspaceId: body.workspaceId },
    });
    if (channelCampaigns.length === 0) {
      throw new DomainError(
        "NOT_FOUND",
        `Campaign ${p.id} hat keine ChannelCampaign — erst syncen oder re-linken.`,
      );
    }

    const from = body.from ?? yesterdayUtc();
    const to = body.to ?? startOfUtcDay(new Date());

    const results = [];
    for (const cc of channelCampaigns) {
      if (cc.channel !== "GOOGLE_ADS") continue;

      const idempotencyKey = `pull:structure:${cc.id}:${Date.now()}`;
      const { id: syncRunId } = await syncRunService.createOrGet({
        workspaceId: body.workspaceId,
        channel: "GOOGLE_ADS",
        type: "PULL_PERFORMANCE",
        targetType: "CHANNEL_CAMPAIGN",
        targetId: cc.id,
        idempotencyKey,
        input: { from, to, scope: "structure+level_performance" },
      });
      await syncRunService.markRunning(syncRunId);

      try {
        const structureResult = await channelStructureService.syncGoogleAdsCampaign({
          workspaceId: body.workspaceId,
          channelCampaignId: cc.id,
          ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
        });
        const levelResult = await channelStructureService.syncGoogleAdsLevelPerformance({
          workspaceId: body.workspaceId,
          channelCampaignId: cc.id,
          from,
          to,
          syncRunId,
        });
        await syncRunService.markSucceeded(syncRunId, {
          ...structureResult,
          ...levelResult,
        });
        results.push({
          channelCampaignId: cc.id,
          syncRunId,
          structure: structureResult,
          performance: levelResult,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const kind = (err as { kind?: string })?.kind ?? "UNKNOWN";
        await syncRunService.markFailed(syncRunId, kind, message);
        throw err;
      }
    }

    return { results };
  });

  // ── GET /channel-ad-groups/:id/performance ─────────────────────
  app.get("/channel-ad-groups/:id/performance", async (req) => {
    const p = z.object({ id: z.string().startsWith("cag_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .parse(req.query);

    // Ownership-Check via Join.
    const ag = await prisma.channelAdGroup.findFirst({
      where: { id: p.id, channelCampaign: { workspaceId: q.workspaceId } },
      select: { id: true },
    });
    if (!ag) throw new DomainError("NOT_FOUND", `ChannelAdGroup ${p.id} not found`);

    const rows = await performanceService.queryAdGroup(p.id, q.from, q.to);
    return rows.map(serializeBigInt);
  });

  // ── GET /channel-keywords/:id/performance ──────────────────────
  app.get("/channel-keywords/:id/performance", async (req) => {
    const p = z.object({ id: z.string().startsWith("ckw_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .parse(req.query);

    const kw = await prisma.channelKeyword.findFirst({
      where: {
        id: p.id,
        OR: [
          { channelAdGroup: { channelCampaign: { workspaceId: q.workspaceId } } },
          { channelCampaign: { workspaceId: q.workspaceId } },
        ],
      },
      select: { id: true },
    });
    if (!kw) throw new DomainError("NOT_FOUND", `ChannelKeyword ${p.id} not found`);

    const rows = await performanceService.queryKeyword(p.id, q.from, q.to);
    return rows.map(serializeBigInt);
  });

  // ── GET /channel-ads/:id/performance ───────────────────────────
  app.get("/channel-ads/:id/performance", async (req) => {
    const p = z.object({ id: z.string().startsWith("cad_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .parse(req.query);

    const ad = await prisma.channelAd.findFirst({
      where: {
        id: p.id,
        channelAdGroup: { channelCampaign: { workspaceId: q.workspaceId } },
      },
      select: { id: true },
    });
    if (!ad) throw new DomainError("NOT_FOUND", `ChannelAd ${p.id} not found`);

    const rows = await performanceService.queryAd(p.id, q.from, q.to);
    return rows.map(serializeBigInt);
  });

  // ── GET /campaigns/:id/outcome-attribution ─────────────────────
  // Liefert OS-seitige Conversions (aus `ProductOutcomeEvent`)
  // gruppiert nach utm_content (≙ externalAdGroupId) und utm_term
  // (≙ Keyword-Text). Basis für die "OS-Conv"-Spalte.
  app.get("/campaigns/:id/outcome-attribution", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);

    const campaign = await prisma.campaign.findFirst({
      where: { id: p.id, workspaceId: q.workspaceId },
      include: {
        campaignAssets: {
          include: {
            asset: {
              include: {
                versions: {
                  where: { status: { not: "DRAFT" } },
                  orderBy: { versionNum: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!campaign) throw new DomainError("NOT_FOUND", `Campaign ${p.id} not found`);

    const utmCampaignValues = new Set<string>();
    const targetUrls: string[] = [];
    for (const ca of campaign.campaignAssets) {
      const version = ca.asset.versions[0];
      if (!version) continue;
      const c = (version.content ?? {}) as Record<string, unknown>;
      const url = typeof c.targetUrl === "string" ? c.targetUrl : null;
      if (!url) continue;
      targetUrls.push(url);
      try {
        const u = new URL(url);
        const utm = u.searchParams.get("utm_campaign");
        if (utm) utmCampaignValues.add(utm);
      } catch {
        // ignore unparseable
      }
    }

    const from = q.from ?? daysAgoUtc(30);
    const to = q.to ?? startOfUtcDay(new Date());

    const breakdown = await outcomeService.breakdownByAdGroupAndKeyword({
      productId: campaign.productId,
      utmCampaignValues: Array.from(utmCampaignValues),
      from,
      to,
    });

    return {
      utmCampaignValues: Array.from(utmCampaignValues),
      targetUrls,
      from,
      to,
      ...breakdown,
    };
  });

  // ── POST /channel-campaigns/:ccId/tracking-suffix ──────────────
  // Setzt final_url_suffix auf der Google-Ads-Kampagne, damit jeder
  // Klick automatisch utm_content={adgroupid} und utm_term={keyword}
  // mitschickt. Pflicht-Schritt, damit OS-Attribution pro AdGroup /
  // Keyword funktioniert.
  app.post("/channel-campaigns/:ccId/tracking-suffix", async (req) => {
    const p = z.object({ ccId: z.string().startsWith("ccp_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        actorId: z.string().optional(),
        suffix: z
          .string()
          .optional()
          .describe(
            "Expliziter Tracking-Suffix. Default: utm_source=google&utm_medium=cpc" +
              "&utm_campaign=<der utm_campaign-Wert aus den Campaign-Assets>" +
              "&utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}",
          ),
      })
      .parse(req.body);

    const cc = await prisma.channelCampaign.findFirst({
      where: { id: p.ccId, workspaceId: body.workspaceId },
      include: {
        campaign: {
          include: {
            campaignAssets: {
              include: {
                asset: {
                  include: {
                    versions: {
                      where: { status: { not: "DRAFT" } },
                      orderBy: { versionNum: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        channelConnection: { include: { integrationAccount: true } },
      },
    });
    if (!cc) throw new DomainError("NOT_FOUND", `ChannelCampaign ${p.ccId} not found`);
    if (cc.channel !== "GOOGLE_ADS") {
      throw new DomainError("INVALID_STATE", "Tracking-Suffix nur für GOOGLE_ADS");
    }
    if (!cc.externalId) {
      throw new DomainError("INVALID_STATE", "ChannelCampaign hat keine externalId");
    }
    const ica = cc.channelConnection?.integrationAccount;
    if (!ica) throw new DomainError("INVALID_STATE", "Keine IntegrationAccount");

    let suffix = body.suffix;
    if (!suffix) {
      let utmCampaign: string | null = null;
      for (const ca of cc.campaign.campaignAssets) {
        const v = ca.asset.versions[0];
        if (!v) continue;
        const c = (v.content ?? {}) as Record<string, unknown>;
        const url = typeof c.targetUrl === "string" ? c.targetUrl : null;
        if (!url) continue;
        try {
          const u = new URL(url);
          const utm = u.searchParams.get("utm_campaign");
          if (utm) {
            utmCampaign = utm;
            break;
          }
        } catch {}
      }
      if (!utmCampaign) {
        throw new DomainError(
          "INVALID_INPUT",
          "Kein utm_campaign in Campaign-Assets gefunden. Übergib `suffix` explizit oder setze utm_campaign in einer Asset-Version.",
        );
      }
      suffix =
        `utm_source=google&utm_medium=cpc` +
        `&utm_campaign=${encodeURIComponent(utmCampaign)}` +
        `&utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}`;
    }

    await googleAdsConnector.authenticate({
      id: ica.id,
      channel: "google_ads",
      externalId: ica.externalId,
      credentialsEncrypted: JSON.stringify(ica.credentials),
    });
    await googleAdsConnector.setCampaignFinalUrlSuffix(
      ica.externalId,
      cc.externalId,
      suffix,
    );

    await changeEventService.append({
      workspaceId: body.workspaceId,
      subjectType: "CHANNEL_CAMPAIGN",
      subjectId: cc.id,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      kind: "channel_campaign.tracking_suffix_set",
      summary: `Final-URL-Suffix gesetzt (${suffix.length} Zeichen)`,
      payload: { suffix },
    });

    return { ok: true, suffix };
  });

  // ── GET /campaigns/:id/changelog-tree ──────────────────────────
  // Liefert Change-Events für Campaign + alle Kinder (ChannelCampaign,
  // AdGroup, Ad, Keyword) für Before/After-Auswertung.
  app.get("/campaigns/:id/changelog-tree", async (req) => {
    const p = z.object({ id: z.string().startsWith("cmp_") }).parse(req.params);
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);

    const ccps = await prisma.channelCampaign.findMany({
      where: { campaignId: p.id, workspaceId: q.workspaceId },
      include: {
        adGroups: { include: { ads: true, keywords: true } },
        negatives: true,
      },
    });

    const ids: Array<{ subjectType: string; id: string }> = [
      { subjectType: "CAMPAIGN", id: p.id },
    ];
    for (const cc of ccps) {
      ids.push({ subjectType: "CHANNEL_CAMPAIGN", id: cc.id });
      for (const ag of cc.adGroups) {
        ids.push({ subjectType: "CHANNEL_AD_GROUP", id: ag.id });
        for (const ad of ag.ads) ids.push({ subjectType: "CHANNEL_AD", id: ad.id });
        for (const kw of ag.keywords) ids.push({ subjectType: "CHANNEL_KEYWORD", id: kw.id });
      }
      for (const neg of cc.negatives) ids.push({ subjectType: "CHANNEL_KEYWORD", id: neg.id });
    }

    if (ids.length === 0) return [];

    const events = await prisma.changeEvent.findMany({
      where: {
        workspaceId: q.workspaceId,
        OR: ids.map((x) => ({ subjectType: x.subjectType, subjectId: x.id })),
        ...(q.from || q.to
          ? {
              at: {
                ...(q.from ? { gte: q.from } : {}),
                ...(q.to ? { lte: q.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { at: "desc" },
    });

    return events;
  });
}
