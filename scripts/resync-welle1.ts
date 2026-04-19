// Re-sync an existing Google Ads campaign into the OS when the campaign already
// lives on Google Ads side (e.g. created in an earlier OS lifecycle), but the
// OS-side link rows were lost or were never persisted on the current database.
//
// Idempotent:
//   - upserts IntegrationAccount + ChannelConnection (same shape as setup:google-ads)
//   - upserts ChannelCampaign by (channel, externalId)
//   - upserts ChannelAdGroup
//   - transitions internal Campaign to SYNCED if currently APPROVED
//   - runs pullPerformance(from=yesterday, to=today) and writes a SUCCEEDED SyncRun
//
// Optional --budget=<eur> performs an OS-originated budget update on Google Ads
// (fieldMask=amount_micros) against the existing budget resource of the campaign.
//
// Usage:
//   npm run resync:welle1 -- --campaign=cmp_... --external-campaign=23766896581 \
//       --external-ad-group=195650681237 [--budget=30]

import { prisma } from "../src/services/prisma.js";
import { loadEnv } from "../src/config/env.js";
import { newId } from "../src/lib/ids.js";
import { logger } from "../src/lib/logger.js";
import { googleAdsConnector } from "../src/connectors/google-ads/index.js";
import { syncRunService } from "../src/services/sync-run.service.js";
import { performanceService } from "../src/services/performance.service.js";
import { campaignService } from "../src/services/campaign.service.js";
import { changeEventService } from "../src/services/change-event.service.js";
import { startOfUtcDay, yesterdayUtc } from "../src/lib/time.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const WORKSPACE = "wsp_pflegemax_team";

async function main() {
  const env = loadEnv();

  const campaignId = arg("campaign") ?? "cmp_01KPC0KJWDBXCWJ0J9KW95YA37";
  const externalCampaignId = arg("external-campaign") ?? "23766896581";
  const externalAdGroupId = arg("external-ad-group") ?? "195650681237";
  const budgetEur = arg("budget") ? Number(arg("budget")) : undefined;

  const customerId = env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google Ads env vars (GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN, " +
        "GOOGLE_ADS_OAUTH_CLIENT_ID, GOOGLE_ADS_OAUTH_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN).",
    );
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error(
      `Campaign ${campaignId} not found in this DB. Run against the DB where Welle-1 is seeded, ` +
        "or pass --campaign=<id> pointing at the right internal Campaign.",
    );
  }
  if (campaign.workspaceId !== WORKSPACE) {
    throw new Error(
      `Campaign ${campaignId} belongs to workspace ${campaign.workspaceId}, expected ${WORKSPACE}.`,
    );
  }

  let credentialsValue: object;
  if (env.MOS_CREDENTIAL_KEY) {
    const { encryptSecret } = await import("../src/lib/secrets.js");
    const encrypted = encryptSecret(JSON.stringify({ refreshToken, clientId, clientSecret }));
    credentialsValue = { encrypted };
  } else {
    credentialsValue = { refreshToken, clientId, clientSecret };
  }

  const ica = await prisma.integrationAccount.upsert({
    where: {
      workspaceId_channel_externalId: {
        workspaceId: WORKSPACE,
        channel: "GOOGLE_ADS",
        externalId: customerId,
      },
    },
    update: { credentials: credentialsValue, status: "ACTIVE" },
    create: {
      id: newId("integrationAccount"),
      workspaceId: WORKSPACE,
      channel: "GOOGLE_ADS",
      label: `Google Ads ${customerId}`,
      externalId: customerId,
      credentials: credentialsValue,
      status: "ACTIVE",
    },
  });

  let cnc = await prisma.channelConnection.findFirst({
    where: { integrationAccountId: ica.id },
  });
  if (!cnc) {
    cnc = await prisma.channelConnection.create({
      data: {
        id: newId("channelConnection"),
        workspaceId: WORKSPACE,
        integrationAccountId: ica.id,
        label: `Pflegemax ↔ Google Ads ${customerId}`,
      },
    });
  }
  logger.info({ ica: ica.id, cnc: cnc.id }, "integrationAccount + channelConnection ready");

  const existingCc = await prisma.channelCampaign.findFirst({
    where: { channel: "GOOGLE_ADS", externalId: externalCampaignId },
  });

  const cc = existingCc
    ? await prisma.channelCampaign.update({
        where: { id: existingCc.id },
        data: {
          campaignId,
          workspaceId: WORKSPACE,
          channelConnectionId: cnc.id,
          externalName: campaign.name,
          status: "SYNCED",
          lastSyncedAt: new Date(),
        },
      })
    : await prisma.channelCampaign.create({
        data: {
          id: newId("channelCampaign"),
          workspaceId: WORKSPACE,
          campaignId,
          channel: "GOOGLE_ADS",
          channelConnectionId: cnc.id,
          externalId: externalCampaignId,
          externalName: campaign.name,
          status: "SYNCED",
          lastSyncedAt: new Date(),
        },
      });

  const existingAg = await prisma.channelAdGroup.findFirst({
    where: { channelCampaignId: cc.id, externalId: externalAdGroupId },
  });
  if (!existingAg) {
    await prisma.channelAdGroup.create({
      data: {
        id: newId("channelAdGroup"),
        channelCampaignId: cc.id,
        externalId: externalAdGroupId,
        name: `${campaign.name} — Ad Group`,
      },
    });
  }
  logger.info({ cc: cc.id, externalCampaignId, externalAdGroupId }, "channelCampaign linked");

  await changeEventService.append({
    workspaceId: WORKSPACE,
    subjectType: "CHANNEL_CAMPAIGN",
    subjectId: cc.id,
    kind: "channel_campaign.relinked",
    summary: `Re-linked ${campaign.name} to Google Ads campaign ${externalCampaignId}`,
    payload: { externalCampaignId, externalAdGroupId, customerId },
  });

  if (campaign.status === "APPROVED") {
    await campaignService.transition({
      workspaceId: WORKSPACE,
      campaignId,
      to: "SYNCED",
      reason: `Re-linked to existing Google Ads campaign ${externalCampaignId}`,
    });
    logger.info("campaign transitioned APPROVED → SYNCED");
  }

  const handle = await googleAdsConnector.authenticate({
    id: ica.id,
    channel: "google_ads",
    externalId: customerId,
    credentialsEncrypted: JSON.stringify(ica.credentials),
  });

  const from = yesterdayUtc();
  const to = startOfUtcDay(new Date());
  const idempotencyKey = `pull:${cnc.id}:${to.toISOString().slice(0, 10)}:resync:${Date.now()}`;
  const { id: syncRunId } = await syncRunService.createOrGet({
    workspaceId: WORKSPACE,
    channel: "GOOGLE_ADS",
    type: "PULL_PERFORMANCE",
    targetType: "CHANNEL_CONNECTION",
    targetId: cnc.id,
    idempotencyKey,
    input: { from, to, reason: "resync" },
  });
  await syncRunService.markRunning(syncRunId);

  try {
    const pull = await googleAdsConnector.pullPerformance({ connection: handle, from, to });
    let matched = 0;
    for (const row of pull.rows) {
      if (row.externalCampaignId !== externalCampaignId) continue;
      await performanceService.upsertDaily({
        channelCampaignId: cc.id,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        costMicros: row.costMicros,
        conversions: row.conversions,
        conversionValue: row.conversionValue,
        raw: row.raw,
        syncRunId,
      });
      matched += 1;
    }
    await syncRunService.markSucceeded(syncRunId, {
      rowCount: pull.rows.length,
      rowsForCampaign: matched,
    });
    logger.info({ syncRunId, matched, totalRows: pull.rows.length }, "performance pull ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const kind = (err as { kind?: string })?.kind ?? "UNKNOWN";
    await syncRunService.markFailed(syncRunId, kind, message);
    throw err;
  }

  if (budgetEur !== undefined) {
    if (!Number.isFinite(budgetEur) || budgetEur <= 0) {
      throw new Error(`--budget must be a positive number, got ${budgetEur}`);
    }
    const amountMicros = BigInt(Math.round(budgetEur * 1_000_000));
    const budgetResource = await googleAdsConnector.getCampaignBudgetResource(
      customerId,
      externalCampaignId,
    );
    await googleAdsConnector.updateCampaignBudget(customerId, budgetResource, amountMicros);

    const budgetSyncRunId = newId("syncRun");
    await prisma.syncRun.create({
      data: {
        id: budgetSyncRunId,
        workspaceId: WORKSPACE,
        channel: "GOOGLE_ADS",
        type: "PUSH_CAMPAIGN",
        targetType: "CHANNEL_CAMPAIGN",
        targetId: cc.id,
        status: "SUCCEEDED",
        idempotencyKey: `push:budget:${cc.id}:${Date.now()}`,
        input: { op: "update_budget", amountMicros: amountMicros.toString() },
        output: { budgetResource, amountMicros: amountMicros.toString() },
        startedAt: new Date(),
        finishedAt: new Date(),
        attempt: 1,
      },
    });
    await changeEventService.append({
      workspaceId: WORKSPACE,
      subjectType: "CHANNEL_CAMPAIGN",
      subjectId: cc.id,
      kind: "channel_campaign.budget_updated",
      summary: `Budget updated to €${budgetEur}/day`,
      payload: { budgetResource, amountMicros: amountMicros.toString() },
    });
    logger.info({ budgetResource, amountMicros: amountMicros.toString() }, "budget updated");
  }

  logger.info(
    {
      integrationAccountId: ica.id,
      channelConnectionId: cnc.id,
      channelCampaignId: cc.id,
      externalCampaignId,
      externalAdGroupId,
      budgetEur,
    },
    "resync complete",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
