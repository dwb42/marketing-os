import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { channelMutationService } from "../../services/channel-mutation.service.js";
import { DomainError } from "../../lib/errors.js";
import { canActorSync } from "../../domain/policies.js";
import { WorkspaceIdSchema } from "../schemas.js";
import type { ActorRole } from "../../domain/status.js";

const StatusSchema = z.enum(["ENABLED", "PAUSED"]);
const MatchTypeSchema = z.enum(["EXACT", "PHRASE", "BROAD"]);
const WorkspaceQuery = z.object({ workspaceId: WorkspaceIdSchema });

const StatusBody = z.object({
  workspaceId: WorkspaceIdSchema,
  status: StatusSchema,
  actorId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

const RemoveQuery = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

function requireSync(role: ActorRole) {
  if (!canActorSync(role)) {
    throw new DomainError("FORBIDDEN", `Role '${role}' cannot mutate external channel state`);
  }
}

export async function registerChannelMutationRoutes(app: FastifyInstance): Promise<void> {
  // ── ChannelCampaign ────────────────────────────────────────────

  app.post("/channel-campaigns/:ccId/status", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ ccId: z.string().startsWith("ccp_") }).parse(req.params);
    const body = StatusBody.parse(req.body);
    return channelMutationService.setCampaignStatus({
      workspaceId: body.workspaceId,
      channelCampaignId: p.ccId,
      status: body.status,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.post("/channel-campaigns/:ccId/budget", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ ccId: z.string().startsWith("ccp_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        amountMicros: z.string().regex(/^\d+$/).optional(),
        amountEur: z.number().positive().optional(),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .refine((b) => b.amountMicros !== undefined || b.amountEur !== undefined, {
        message: "amountMicros or amountEur required",
      })
      .parse(req.body);
    const amountMicros =
      body.amountMicros !== undefined
        ? BigInt(body.amountMicros)
        : BigInt(Math.round(body.amountEur! * 1_000_000));
    return channelMutationService.updateCampaignBudget({
      workspaceId: body.workspaceId,
      channelCampaignId: p.ccId,
      amountMicros,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.post("/channel-campaigns/:ccId/negative-keywords", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ ccId: z.string().startsWith("ccp_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        keywords: z
          .array(z.object({ text: z.string().min(1).max(80), matchType: MatchTypeSchema }))
          .min(1)
          .max(100),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    return channelMutationService.addCampaignNegativeKeywords({
      workspaceId: body.workspaceId,
      channelCampaignId: p.ccId,
      keywords: body.keywords,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  // ── ChannelAdGroup ─────────────────────────────────────────────

  app.post("/channel-ad-groups/:agId/status", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ agId: z.string().startsWith("cag_") }).parse(req.params);
    const body = StatusBody.parse(req.body);
    return channelMutationService.setAdGroupStatus({
      workspaceId: body.workspaceId,
      channelAdGroupId: p.agId,
      status: body.status,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.post("/channel-ad-groups/:agId/bid", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ agId: z.string().startsWith("cag_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        cpcBidMicros: z.string().regex(/^\d+$/),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    return channelMutationService.updateAdGroupBid({
      workspaceId: body.workspaceId,
      channelAdGroupId: p.agId,
      cpcBidMicros: BigInt(body.cpcBidMicros),
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.post("/channel-ad-groups/:agId/keywords", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ agId: z.string().startsWith("cag_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        keywords: z
          .array(
            z.object({
              text: z.string().min(1).max(80),
              matchType: MatchTypeSchema,
              cpcBidMicros: z.string().regex(/^\d+$/).optional(),
              negative: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(100),
        addHealthPolicyExemption: z.boolean().optional(),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    return channelMutationService.addKeywords({
      workspaceId: body.workspaceId,
      channelAdGroupId: p.agId,
      keywords: body.keywords.map((k) => ({
        text: k.text,
        matchType: k.matchType,
        ...(k.cpcBidMicros !== undefined ? { cpcBidMicros: BigInt(k.cpcBidMicros) } : {}),
        ...(k.negative !== undefined ? { negative: k.negative } : {}),
      })),
      ...(body.addHealthPolicyExemption !== undefined
        ? { addHealthPolicyExemption: body.addHealthPolicyExemption }
        : {}),
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.post("/channel-ad-groups/:agId/ads", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ agId: z.string().startsWith("cag_") }).parse(req.params);
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        content: z.object({
          headlines: z.array(z.string().min(1).max(30)).min(3).max(15),
          descriptions: z.array(z.string().min(1).max(90)).min(2).max(4),
          finalUrls: z.array(z.string().url()).min(1),
          path1: z.string().max(15).nullable().optional(),
          path2: z.string().max(15).nullable().optional(),
        }),
        paused: z.boolean().optional(),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    return channelMutationService.addResponsiveSearchAd({
      workspaceId: body.workspaceId,
      channelAdGroupId: p.agId,
      content: body.content,
      ...(body.paused !== undefined ? { paused: body.paused } : {}),
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  // ── ChannelAd ──────────────────────────────────────────────────

  app.post("/channel-ads/:adId/status", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ adId: z.string().startsWith("cad_") }).parse(req.params);
    const body = StatusBody.parse(req.body);
    return channelMutationService.setAdStatus({
      workspaceId: body.workspaceId,
      channelAdId: p.adId,
      status: body.status,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.patch("/channel-ads/:adId", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ adId: z.string().startsWith("cad_") }).parse(req.params);
    const RsaAsset = z.object({
      text: z.string().min(1).max(90),
      pinnedField: z.string().nullable().optional(),
    });
    const body = z
      .object({
        workspaceId: WorkspaceIdSchema,
        headlines: z.array(RsaAsset).min(3).max(15).optional(),
        descriptions: z.array(RsaAsset).min(2).max(4).optional(),
        path1: z.string().max(15).nullable().optional(),
        path2: z.string().max(15).nullable().optional(),
        finalUrls: z.array(z.string().url()).min(1).optional(),
        actorId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(req.body);
    const { workspaceId, actorId, reason, ...patch } = body;
    return channelMutationService.updateAdContent({
      workspaceId,
      channelAdId: p.adId,
      patch,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  });

  // ── ChannelKeyword ─────────────────────────────────────────────

  app.post("/channel-keywords/:kwId/status", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ kwId: z.string().startsWith("ckw_") }).parse(req.params);
    const body = StatusBody.parse(req.body);
    return channelMutationService.setKeywordStatus({
      workspaceId: body.workspaceId,
      channelKeywordId: p.kwId,
      status: body.status,
      ...(body.actorId !== undefined ? { actorId: body.actorId } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  });

  app.delete("/channel-keywords/:kwId", async (req) => {
    requireSync(req.auth.role as ActorRole);
    const p = z.object({ kwId: z.string().startsWith("ckw_") }).parse(req.params);
    const q = RemoveQuery.parse(req.query);
    return channelMutationService.removeKeyword({
      workspaceId: q.workspaceId,
      channelKeywordId: p.kwId,
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
    });
  });
}
