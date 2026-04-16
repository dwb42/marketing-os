import { prisma } from "../src/services/prisma.js";
import { campaignService } from "../src/services/campaign.service.js";
import { assetService } from "../src/services/asset.service.js";
import { approvalService } from "../src/services/approval.service.js";
import { initiativeService } from "../src/services/initiative.service.js";
import { logger } from "../src/lib/logger.js";

const WORKSPACE = "wsp_pflegemax_team";
const ACTOR_REVIEWER = "act_reviewer";
const ACTOR_OPERATOR = "act_operator";

async function ensureActors() {
  for (const actor of [
    { id: ACTOR_REVIEWER, type: "AGENT" as const, handle: "reviewer-agent", agentRole: "reviewer" },
    { id: ACTOR_OPERATOR, type: "HUMAN" as const, handle: "operator-human", agentRole: "operator" },
  ]) {
    await prisma.actor.upsert({
      where: { handle: actor.handle },
      update: {},
      create: actor,
    });
  }
}

async function main() {
  await ensureActors();

  // Find Welle 1 campaign
  const campaigns = await campaignService.list(WORKSPACE, {});
  const campaign = campaigns.find(c => c.name === "Hilfesuchende Pflegegeld — Google Search DE");
  if (!campaign) {
    throw new Error("Welle 1 campaign not found — run `npm run seed:welle1` first");
  }
  logger.info({ campaignId: campaign.id, status: campaign.status }, "found campaign");

  // Find initiative and activate it
  if (campaign.initiativeId) {
    const initiative = await prisma.initiative.findUnique({ where: { id: campaign.initiativeId } });
    if (initiative && initiative.status === "PROPOSED") {
      await initiativeService.setStatus(WORKSPACE, initiative.id, "ACTIVE", ACTOR_OPERATOR);
      logger.info({ initiativeId: initiative.id }, "initiative → ACTIVE");
    }
  }

  // Find all assets linked to this campaign
  const campaignAssets = await prisma.campaignAsset.findMany({
    where: { campaignId: campaign.id },
    include: {
      asset: {
        include: {
          versions: { orderBy: { versionNum: "desc" }, take: 1 },
        },
      },
    },
  });

  // Transition each asset version: DRAFT → IN_REVIEW → APPROVED
  for (const ca of campaignAssets) {
    const version = ca.asset.versions[0];
    if (!version) continue;

    if (version.status === "DRAFT") {
      await assetService.transitionVersion({
        workspaceId: WORKSPACE,
        assetVersionId: version.id,
        to: "IN_REVIEW",
        actorId: ACTOR_REVIEWER,
      });
      logger.info({ assetVersionId: version.id, asset: ca.asset.name }, "asset version → IN_REVIEW");
    }

    const refreshed = await prisma.assetVersion.findUnique({ where: { id: version.id } });
    if (refreshed?.status === "IN_REVIEW") {
      await approvalService.record({
        workspaceId: WORKSPACE,
        targetType: "ASSET_VERSION",
        targetId: version.id,
        decision: "APPROVED",
        comment: "Reviewer-Pass: Welle 1 approved (Sprache, Pflichtfelder, Operations-Check bestanden).",
        payload: {
          reviewer: "marketing-workspace-reviewer",
          reviewRef: "reviews/welle1-gesamt_2026-04-16.md",
          verdict: "approved",
        },
        actorId: ACTOR_REVIEWER,
      });
      await assetService.transitionVersion({
        workspaceId: WORKSPACE,
        assetVersionId: version.id,
        to: "APPROVED",
        actorId: ACTOR_REVIEWER,
      });
      logger.info({ assetVersionId: version.id, asset: ca.asset.name }, "asset version → APPROVED");
    }
  }

  // Transition campaign: DRAFT → IN_REVIEW → APPROVED
  if (campaign.status === "DRAFT") {
    await campaignService.transition({
      workspaceId: WORKSPACE,
      campaignId: campaign.id,
      to: "IN_REVIEW",
      actorId: ACTOR_REVIEWER,
      reason: "Alle Assets approved, Pflichtfelder vollständig.",
    });
    logger.info({ campaignId: campaign.id }, "campaign → IN_REVIEW");
  }

  const refreshedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
  if (refreshedCampaign?.status === "IN_REVIEW") {
    await approvalService.record({
      workspaceId: WORKSPACE,
      targetType: "CAMPAIGN",
      targetId: campaign.id,
      decision: "APPROVED",
      comment: "Kampagne approved für Google Ads Sync. Hypothese, Outcome-Leiter, Keywords, Headlines, LP — alles geprüft.",
      payload: {
        reviewer: "marketing-workspace-reviewer",
        reviewRef: "reviews/welle1-gesamt_2026-04-16.md",
        verdict: "approved",
        prelaunchChecklist: {
          tracking_e2e: true,
          whatsapp_business: true,
          lp_deployed: true,
          impressum_datenschutz: true,
          google_ads_policy_check: "pending",
        },
      },
      actorId: ACTOR_REVIEWER,
    });
    await campaignService.transition({
      workspaceId: WORKSPACE,
      campaignId: campaign.id,
      to: "APPROVED",
      actorId: ACTOR_OPERATOR,
      reason: "Bereit für Google Ads Sync.",
    });
    logger.info({ campaignId: campaign.id }, "campaign → APPROVED");
  }

  // Final state
  const finalCampaign = await campaignService.get(WORKSPACE, campaign.id);
  const approvals = await approvalService.listForTarget(WORKSPACE, "CAMPAIGN", campaign.id);

  logger.info({
    campaign: {
      id: finalCampaign.id,
      name: finalCampaign.name,
      status: finalCampaign.status,
      initiative: finalCampaign.initiativeId,
      assets: finalCampaign.campaignAssets?.map((ca) => `${ca.role}: ${ca.assetId}`),
    },
    approvals: approvals.length,
  }, "welle1 campaign approved and ready for sync");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
