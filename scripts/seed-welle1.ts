import { prisma } from "../src/services/prisma.js";
import { newId } from "../src/lib/ids.js";
import { initiativeService } from "../src/services/initiative.service.js";
import { campaignService } from "../src/services/campaign.service.js";
import { assetService } from "../src/services/asset.service.js";
import { hypothesisService } from "../src/services/hypothesis.service.js";
import { clusterService } from "../src/services/cluster.service.js";
import { logger } from "../src/lib/logger.js";

const WORKSPACE = "wsp_pflegemax_team";
const PRODUCT = "prd_pflegemax_core";
const ACTOR = "act_marketing_agent";

async function ensureActor() {
  await prisma.actor.upsert({
    where: { handle: "marketing-workspace" },
    update: {},
    create: {
      id: ACTOR,
      type: "AGENT",
      handle: "marketing-workspace",
      agentRole: "operator",
    },
  });
}

async function main() {
  await ensureActor();

  const initiativeId = await initiativeService.propose({
    workspaceId: WORKSPACE,
    title: "Hilfesuchende Pflegegeld — Medienbruch-Test",
    goal: "Testen ob Hilfesuchende aus Google den Medienbruch Browser → WhatsApp akzeptieren und Consent erteilen.",
    modules: [
      "pflegegrad-antrag",
      "pflegegrad-simulation",
      "leistungsauswahl",
      "pflegewegweiser",
    ],
    outcomeLadder: [
      "chat_gestartet",
      "consent_erteilt",
      "wegweiser_durchlaufen",
      "antrag_gestellt|simulation_durchlaufen|leistungen_ausgewaehlt",
    ],
    hypothesis:
      "Wenn wir Hilfesuchende aus Google auf eine schlanke LP bringen die Hilfe beim Pflegegeldantrag verspricht und als nächsten Schritt WhatsApp anbietet, dann akzeptiert ein messbarer Anteil den Medienbruch — weil der versprochene Nutzen die Reibung übersteigt.",
    learnQuestions: [
      "Akzeptieren LP-Besucher den Medienbruch Browser → WhatsApp?",
      "Erteilen Chat-Starter den Consent?",
      "Welche Artefakte werden tatsächlich generiert?",
    ],
    assumptions: [
      "Hilfesuche-Modifier selektieren konversionsbereitere Nutzer",
      "Medienbruch ist die größte Reibungsstelle",
      "WhatsApp-only hält Kanalverlust unter 2%",
    ],
    risks: [
      "Google Ads Policies im Pflegekontext",
      "Trust-Hürde fremde WhatsApp-Nummer",
      "Stichprobenrisiko bei 100 Besuchern",
    ],
    successCriteria:
      "Chat-Start-Anteil >= 5%, Consent-Anteil >= 50% (Orientierung, nicht Commitment)",
    actorId: ACTOR,
  });

  const clusterId = await clusterService.create({
    workspaceId: WORKSPACE,
    productId: PRODUCT,
    initiativeId,
    name: "hilfesuchende-pflegegeld",
    modulPrimary: "cross-modul",
    modulSecondary: [
      "pflegegrad-antrag",
      "pflegegrad-simulation",
      "leistungsauswahl",
      "pflegewegweiser",
    ],
    outcome: "chat_gestartet",
    lebenslage:
      "Mensch mit akutem Pflegebedarf, googelt gezielt nach Hilfe beim Pflegegeld, überfordert, wenig Geduld.",
    suchbegriffe: [
      "Pflegegeld Antrag Hilfe",
      "Pflegegrad beantragen Beratung",
      "Antrag Pflegekasse Hilfe",
      "Pflegegrad berechnen Hilfe",
      "Pflegeleistungen Beratung",
    ],
    naechsteAktion:
      "WhatsApp-Chat starten, Consent erteilen, eines der vier Module wählen.",
    actorId: ACTOR,
  });

  const campaignId = await campaignService.createDraft({
    workspaceId: WORKSPACE,
    productId: PRODUCT,
    initiativeId,
    name: "Hilfesuchende Pflegegeld — Google Search DE",
    objective: "100 LP-Besucher, Medienbruch + Consent messen.",
    actorId: ACTOR,
  });

  const adsAssetId = await assetService.createAsset({
    workspaceId: WORKSPACE,
    kind: "HEADLINE_SET",
    name: "Hilfesuchende Pflegegeld — Headlines + Descriptions v01",
    actorId: ACTOR,
  });

  const adsVersionId = await assetService.addVersion({
    workspaceId: WORKSPACE,
    assetId: adsAssetId,
    content: {
      headlines: [
        "Pflegegeld-Antrag mit Hilfe",
        "Pflegegeld? Wir helfen dir.",
        "Pflegegrad beantragen – mit uns",
        "Antrag in 10 Minuten per Chat",
        "Schritt für Schritt zum Pflegegeld",
        "Dein fertiges PDF zum Ausdrucken",
        "Ruhig erklärt, ohne Amtsdeutsch",
        "Keine Formulare, einfach Chat",
        "Kostenlos und rund um die Uhr",
        "Hilfe beim Pflegegeld-Antrag",
        "Pflegeberatung per WhatsApp",
        "Pflegegeld-Hilfe per Chat",
      ],
      descriptions: [
        "Wir helfen beim Antrag – per Chat, in wenigen Minuten. Kostenlos starten.",
        "Überfordert mit dem Pflegegeld? Wir begleiten dich Schritt für Schritt – ruhig und klar.",
        "Antrag stellen. Pflegegrad einschätzen. Leistungen finden. Alles per Chat, ohne Formulare.",
      ],
      keywords: [
        "Pflegegeld Antrag Hilfe",
        "Pflegegeld beantragen Unterstützung",
        "Antrag Pflegekasse Hilfe",
        "Pflegegrad beantragen Beratung",
        "Pflegegrad beantragen Hilfe",
        "Pflegegrad berechnen Hilfe",
        "Pflegegradsimulation Beratung",
        "Pflegeleistungen Beratung",
        "Pflegegeld maximieren Hilfe",
      ],
      negativeKeywords: [
        "selbst",
        "Formular download",
        "Vorlage",
        "Höhe",
        "Tabelle",
        "2024",
        "2025",
        "Ratgeber",
        "Lexikon",
        "Wikipedia",
        "Forum",
      ],
      targetUrl:
        "https://pflegeberatung.b42.io/?utm_source=google&utm_medium=cpc&utm_campaign=hilfesuchende-pflegegeld",
    },
    actorId: ACTOR,
  });

  const lpAssetId = await assetService.createAsset({
    workspaceId: WORKSPACE,
    kind: "LANDING_PAGE",
    name: "Hilfesuchende Pflegegeld — LP WhatsApp-only v01",
    actorId: ACTOR,
  });

  await assetService.addVersion({
    workspaceId: WORKSPACE,
    assetId: lpAssetId,
    content: {
      url: "https://pflegeberatung.b42.io/",
      h1: "Hilfe beim Pflegegeld-Antrag — per Chat.",
      subline:
        "Deine virtuelle Pflegeberatung per WhatsApp. Schreib uns — wir begleiten dich Schritt für Schritt.",
      cta_label: "Jetzt auf WhatsApp schreiben",
      cta_whatsapp_number: "4915757131669",
      micro_copy: "Rund um die Uhr. Sofortige Antwort. Kostenlos.",
      variant: "whatsapp-only-v01",
    },
    actorId: ACTOR,
  });

  await prisma.campaignAsset.createMany({
    data: [
      { campaignId, assetId: adsAssetId, role: "ads_rsa" },
      { campaignId, assetId: lpAssetId, role: "landing_page" },
    ],
    skipDuplicates: true,
  });

  const hypothesisId = await hypothesisService.create({
    workspaceId: WORKSPACE,
    initiativeId,
    statement:
      "Wenn wir Hilfesuchende aus Google auf eine schlanke LP bringen und als nächsten Schritt WhatsApp anbieten, akzeptiert ein messbarer Anteil den Medienbruch.",
    rationale:
      "Der versprochene Nutzen (jemand hilft konkret beim Pflegegeld) übersteigt die Reibung des ungewohnten Kanalwechsels Browser → Messenger.",
    actorId: ACTOR,
  });

  logger.info(
    {
      initiativeId,
      clusterId,
      campaignId,
      adsAssetId,
      adsVersionId,
      lpAssetId,
      hypothesisId,
    },
    "welle1 seed done",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
