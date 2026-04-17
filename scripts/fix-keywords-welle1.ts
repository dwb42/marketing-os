import { loadEnv } from "../src/config/env.js";
import { refreshAccessToken } from "../src/connectors/google-ads/auth.js";
import { ConnectorError } from "../src/connectors/types.js";
import { prisma } from "../src/services/prisma.js";
import { campaignService } from "../src/services/campaign.service.js";
import { syncRunService } from "../src/services/sync-run.service.js";
import { changeEventService } from "../src/services/change-event.service.js";
import { newId } from "../src/lib/ids.js";
import { logger } from "../src/lib/logger.js";

const env = loadEnv();
const BASE = "https://googleads.googleapis.com/v23";

async function googleAdsRequest(method: string, url: string, accessToken: string, body?: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Ads ${response.status}: ${text}`);
  }
  return response.json();
}

async function main() {
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID!;
  const tokens = await refreshAccessToken(
    env.GOOGLE_ADS_OAUTH_CLIENT_ID!,
    env.GOOGLE_ADS_OAUTH_CLIENT_SECRET!,
    env.GOOGLE_ADS_REFRESH_TOKEN!,
  );
  const at = tokens.accessToken;

  // 1. Find existing campaign by name
  logger.info("finding campaign in Google Ads...");
  const searchRes = await googleAdsRequest("POST", `${BASE}/customers/${customerId}/googleAds:searchStream`, at, {
    query: `SELECT campaign.id, campaign.name, campaign.resource_name FROM campaign WHERE campaign.name = 'Hilfesuchende Pflegegeld — Google Search DE' AND campaign.status != 'REMOVED' LIMIT 1`,
  });
  const campaignRow = searchRes[0]?.results?.[0];
  if (!campaignRow) throw new Error("Campaign not found in Google Ads");
  const campaignResource = campaignRow.campaign.resourceName;
  const externalCampaignId = campaignRow.campaign.id;
  logger.info({ externalCampaignId, campaignResource }, "found campaign");

  // 2. Find ad group
  const agRes = await googleAdsRequest("POST", `${BASE}/customers/${customerId}/googleAds:searchStream`, at, {
    query: `SELECT ad_group.id, ad_group.name, ad_group.resource_name FROM ad_group WHERE campaign.id = ${externalCampaignId} AND ad_group.status != 'REMOVED' LIMIT 1`,
  });
  const adGroupRow = agRes[0]?.results?.[0];
  if (!adGroupRow) throw new Error("Ad Group not found");
  const adGroupResource = adGroupRow.adGroup.resourceName;
  const externalAdGroupId = adGroupRow.adGroup.id;
  logger.info({ externalAdGroupId, adGroupResource }, "found ad group");

  // 3. Add keywords with health policy exemption
  const keywords = [
    "Pflegegeld Antrag Hilfe",
    "Pflegegeld beantragen Unterstützung",
    "Antrag Pflegekasse Hilfe",
    "Pflegegrad beantragen Beratung",
    "Pflegegrad beantragen Hilfe",
    "Pflegegrad berechnen Hilfe",
    "Pflegegradsimulation Beratung",
    "Pflegeleistungen Beratung",
    "Pflegegeld maximieren Hilfe",
  ];

  logger.info({ count: keywords.length }, "adding keywords with health policy exemption...");
  try {
    await googleAdsRequest("POST", `${BASE}/customers/${customerId}/adGroupCriteria:mutate`, at, {
      operations: keywords.map((kw) => ({
        create: {
          adGroup: adGroupResource,
          keyword: { text: kw, matchType: "PHRASE" },
        },
        exemptPolicyViolationKeys: [
          { policyName: "HEALTH_IN_PERSONALIZED_ADS", violatingText: kw },
        ],
      })),
    });
    logger.info("keywords added");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "keyword creation failed");
    throw err;
  }

  // 4. Add negative keywords
  const negativeKeywords = [
    "selbst", "Formular download", "Vorlage", "Höhe", "Tabelle",
    "2024", "2025", "Ratgeber", "Lexikon", "Wikipedia", "Forum",
  ];

  logger.info({ count: negativeKeywords.length }, "adding negative keywords...");
  await googleAdsRequest("POST", `${BASE}/customers/${customerId}/campaignCriteria:mutate`, at, {
    operations: negativeKeywords.map((nkw) => ({
      create: {
        campaign: campaignResource,
        negative: true,
        keyword: { text: nkw, matchType: "BROAD" },
      },
    })),
  });
  logger.info("negative keywords added");

  // 5. Update Marketing OS: create ChannelCampaign + transition to SYNCED
  const WORKSPACE = "wsp_pflegemax_team";
  const CAMPAIGN_ID = "cmp_01KPBK4PYSHR1FXNJWCEZC0AH5";

  const existingCC = await prisma.channelCampaign.findFirst({
    where: { campaignId: CAMPAIGN_ID, channel: "GOOGLE_ADS" },
  });

  const channelConnection = await prisma.channelConnection.findFirst({
    where: { workspaceId: WORKSPACE },
  });

  let ccId: string;
  if (existingCC) {
    ccId = existingCC.id;
    logger.info({ ccId }, "channel campaign already exists");
  } else {
    ccId = newId("channelCampaign");
    await prisma.channelCampaign.create({
      data: {
        id: ccId,
        workspaceId: WORKSPACE,
        campaignId: CAMPAIGN_ID,
        channel: "GOOGLE_ADS",
        channelConnectionId: channelConnection?.id ?? null,
        externalId: String(externalCampaignId),
        externalName: "Hilfesuchende Pflegegeld — Google Search DE",
        status: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });
    logger.info({ ccId, externalCampaignId }, "channel campaign created");
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: CAMPAIGN_ID } });
  if (campaign?.status === "APPROVED") {
    await campaignService.transition({
      workspaceId: WORKSPACE,
      campaignId: CAMPAIGN_ID,
      to: "SYNCED",
      actorId: "act_marketing_agent",
      reason: `Synced to Google Ads (campaign ${externalCampaignId}), keywords added with health policy exemption.`,
    });
    logger.info("campaign → SYNCED");
  }

  await changeEventService.append({
    workspaceId: WORKSPACE,
    subjectType: "CHANNEL_CAMPAIGN",
    subjectId: ccId,
    actorId: "act_marketing_agent",
    kind: "channel_campaign.synced",
    summary: `Campaign pushed to Google Ads as ${externalCampaignId}. Keywords: ${keywords.length}, Negatives: ${negativeKeywords.length}. Health policy exemption applied.`,
    payload: { externalCampaignId, externalAdGroupId, keywordCount: keywords.length, negativeCount: negativeKeywords.length },
  });

  logger.info({
    externalCampaignId,
    externalAdGroupId,
    keywords: keywords.length,
    negatives: negativeKeywords.length,
    status: "SYNCED (PAUSED in Google Ads)",
  }, "welle1 sync complete");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
