import { prisma } from "../src/services/prisma.js";
import { newId } from "../src/lib/ids.js";
import { campaignService } from "../src/services/campaign.service.js";
import { assetService } from "../src/services/asset.service.js";
import { initiativeService } from "../src/services/initiative.service.js";
import { hypothesisService } from "../src/services/hypothesis.service.js";
import { experimentService } from "../src/services/experiment.service.js";
import { learningService } from "../src/services/learning.service.js";
import { outcomeService } from "../src/services/outcome.service.js";
import { annotationService } from "../src/services/annotation.service.js";
import { logger } from "../src/lib/logger.js";

// Seed für den Pflegemax-MVP.
// Legt Workspace, Brand, Product, AudienceSegment, Initiative, Campaign
// und erste Assets inkl. Versions an. Idempotent via upsert auf Slugs.

async function main() {
  const workspaceId = "wsp_pflegemax_team";
  const brandId = "brd_pflegemax";
  const productId = "prd_pflegemax_core";
  const audienceId = newId("audienceSegment");

  await prisma.workspace.upsert({
    where: { slug: "pflegemax-team" },
    update: {},
    create: {
      id: workspaceId,
      slug: "pflegemax-team",
      name: "Pflegemax Team",
      timezone: "Europe/Berlin",
    },
  });

  await prisma.brand.upsert({
    where: { workspaceId_slug: { workspaceId, slug: "pflegemax" } },
    update: {},
    create: { id: brandId, workspaceId, name: "Pflegemax", slug: "pflegemax" },
  });

  await prisma.product.upsert({
    where: { workspaceId_slug: { workspaceId, slug: "pflegemax-core" } },
    update: {},
    create: {
      id: productId,
      workspaceId,
      brandId,
      slug: "pflegemax-core",
      name: "Pflegemax — Digitale Pflegeberatung",
      description: "Virtuelle Pflegeberatung. Nutzer zu Chat und konkreten Outcomes führen.",
    },
  });

  await prisma.audienceSegment.create({
    data: {
      id: audienceId,
      workspaceId,
      productId,
      name: "Angehörige in Überforderung",
      description: "Suchen diffus nach Hilfe zu Pflegegeld, Pflegegrad, Pflegeversicherung.",
      facets: {
        intents: [
          "pflegegeld",
          "pflegegrad beantragen",
          "pflegehilfe",
          "pflegeversicherung hilfe",
        ],
      },
    },
  });

  const initiativeId = await initiativeService.propose({
    workspaceId,
    title: "Pflegegrad-Funnel verbessern",
    goal: "Mehr Nutzer vom diffusen Bedarf zum Pflegegrad-PDF führen.",
    actorId: "act_seed",
  });

  const campaignId = await campaignService.createDraft({
    workspaceId,
    productId,
    name: "Pflegegrad — Search DE",
    objective: "Nutzer zum Chat-Start und Pflegegrad-Antrag führen.",
    initiativeId,
    audienceSegmentId: audienceId,
    actorId: "act_seed",
  });

  const headlineAssetId = await assetService.createAsset({
    workspaceId,
    kind: "HEADLINE_SET",
    name: "Pflegegrad — Headlines v1",
    actorId: "act_seed",
  });
  await assetService.addVersion({
    workspaceId,
    assetId: headlineAssetId,
    content: {
      headlines: [
        "Pflegegrad beantragen — Schritt für Schritt",
        "Kostenlos: Dein Pflegegrad in 5 Minuten prüfen",
        "Pflegegeld sichern — ohne Formularchaos",
      ],
    },
    actorId: "act_seed",
  });

  const descAssetId = await assetService.createAsset({
    workspaceId,
    kind: "DESCRIPTION_SET",
    name: "Pflegegrad — Descriptions v1",
    actorId: "act_seed",
  });
  await assetService.addVersion({
    workspaceId,
    assetId: descAssetId,
    content: {
      descriptions: [
        "Starte jetzt den kostenlosen Pflegegrad-Check.",
        "Wir helfen bei Antrag, Einstufung und Pflegetagebuch.",
      ],
    },
    actorId: "act_seed",
  });

  const hypothesisId = await hypothesisService.create({
    workspaceId,
    statement:
      "Direkte Ansprache 'Pflegegrad in 5 Minuten' führt zu mehr Chat-Starts als sachliche Formulierungen.",
    rationale: "Nutzer sind überfordert und wollen schnellen Nutzen statt erklärter Prozesse.",
    initiativeId,
    actorId: "act_seed_strategist",
  });

  const experimentId = await experimentService.design({
    workspaceId,
    title: "Copy-Test: konkreter Nutzen vs. Prozess-Erklärung",
    description: "A: 'Pflegegrad in 5 Min prüfen' · B: 'So beantragen Sie Ihren Pflegegrad'",
    hypothesisId,
    actorId: "act_seed_strategist",
  });
  await experimentService.start(workspaceId, experimentId, "act_seed_strategist");

  await annotationService.create({
    workspaceId,
    subjectType: "CAMPAIGN",
    subjectId: campaignId,
    body: "Initialer Launch der Search-DE-Kampagne, Variante A.",
    occurredAt: new Date(),
    pinned: true,
    actorId: "act_seed_analyst",
  });

  await outcomeService.ingest({
    productId,
    type: "chat_started",
    occurredAt: new Date(),
    sessionRef: "s_seed_1",
    attribution: { utm_source: "google", utm_campaign: "pflegegrad-search-de", utm_content: "variant_a" },
  });

  await learningService.create({
    workspaceId,
    statement: "Früh-Signal: Variante A generiert schnellere erste Nachrichten im Chat.",
    confidence: "LOW",
    evidence: [{ type: "EXPERIMENT", ref: experimentId, note: "Tag 1 Beobachtung" }],
    initiativeId,
    hypothesisId,
    experimentId,
    actorId: "act_seed_analyst",
  });

  logger.info(
    { workspaceId, productId, initiativeId, campaignId, hypothesisId, experimentId },
    "pflegemax seed done",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
