import { prisma } from "../src/services/prisma.js";
import { campaignService } from "../src/services/campaign.service.js";
import { approvalService } from "../src/services/approval.service.js";
import { logger } from "../src/lib/logger.js";

// Smoke-Test: Lauf durch den Campaign-Lifecycle gegen echte DB.
// Voraussetzung: seed-pflegemax.ts wurde ausgeführt.

async function main() {
  const workspaceId = "wsp_pflegemax_team";
  const campaign = await prisma.campaign.findFirst({
    where: { workspaceId, name: "Pflegegrad — Search DE" },
  });
  if (!campaign) throw new Error("Seed-Campaign nicht gefunden. Erst seed:pflegemax ausführen.");

  await campaignService.transition({
    workspaceId,
    campaignId: campaign.id,
    to: "IN_REVIEW",
    actorId: "act_copywriter",
  });

  await approvalService.record({
    workspaceId,
    targetType: "CAMPAIGN",
    targetId: campaign.id,
    decision: "APPROVED",
    actorId: "act_reviewer",
  });

  await campaignService.transition({
    workspaceId,
    campaignId: campaign.id,
    to: "APPROVED",
    actorId: "act_reviewer",
  });

  const events = await prisma.changeEvent.findMany({
    where: { workspaceId, subjectType: "CAMPAIGN", subjectId: campaign.id },
    orderBy: { at: "asc" },
  });

  logger.info({ campaignId: campaign.id, events: events.length }, "smoke ok");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
