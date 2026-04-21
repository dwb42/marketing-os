// Hard-delete campaigns and everything hanging off them.
//
// Removes:
//   - Campaign rows (cascade: ChannelCampaign → ChannelAdGroup → ChannelAd /
//     ChannelKeyword, all per-level PerformanceDaily rows, CampaignAsset links,
//     campaign-level negative ChannelKeywords, PerformanceSnapshotDaily)
//   - Polymorphic refs NOT covered by FK cascade:
//       ChangeEvent, Annotation, Approval, SyncRun where
//       (subjectType|targetType, subjectId|targetId) points at any of the
//       collected Campaign / ChannelCampaign / ChannelAdGroup / ChannelAd /
//       ChannelKeyword ids.
//
// Leaves alone (by design):
//   - Asset / AssetVersion rows (shared resources; only the CampaignAsset link
//     is removed by cascade)
//   - Initiative, Hypothesis, Experiment, Learning, IntentCluster, Finding
//   - ProductOutcomeEvent / AttributionMatch (independent event stream)
//   - Google Ads external state (user removes the campaign in Google Ads UI
//     manually)
//
// Dry-run by default. Pass --yes to commit.
//
// Usage:
//   npx tsx --env-file=.env scripts/delete-campaigns.ts \
//       --workspace=wsp_pflegemax_team --all
//   npx tsx --env-file=.env scripts/delete-campaigns.ts \
//       --campaign=cmp_A --campaign=cmp_B --yes

import { prisma } from "../src/services/prisma.js";
import { loadEnv } from "../src/config/env.js";
import { logger } from "../src/lib/logger.js";

function argValues(name: string): string[] {
  const prefix = `--${name}=`;
  return process.argv.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length));
}
function argValue(name: string): string | undefined {
  return argValues(name)[0];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  loadEnv();

  const commit = hasFlag("yes");
  const workspace = argValue("workspace");
  const explicitIds = argValues("campaign");
  const deleteAll = hasFlag("all");

  if (!explicitIds.length && !(workspace && deleteAll)) {
    console.error(
      "Usage: --campaign=cmp_... [--campaign=...] [--yes]\n" +
        "   or: --workspace=<id> --all [--yes]",
    );
    process.exit(1);
  }

  const campaigns = await prisma.campaign.findMany({
    where: explicitIds.length
      ? { id: { in: explicitIds }, ...(workspace ? { workspaceId: workspace } : {}) }
      : { workspaceId: workspace! },
    include: {
      channelCampaigns: {
        include: {
          adGroups: {
            include: { ads: true, keywords: true },
          },
          negatives: true,
        },
      },
    },
  });

  if (!campaigns.length) {
    console.log("no campaigns matched — nothing to delete.");
    return;
  }

  const campaignIds = campaigns.map((c) => c.id);
  const ccIds = campaigns.flatMap((c) => c.channelCampaigns.map((cc) => cc.id));
  const agIds = campaigns.flatMap((c) =>
    c.channelCampaigns.flatMap((cc) => cc.adGroups.map((ag) => ag.id)),
  );
  const adIds = campaigns.flatMap((c) =>
    c.channelCampaigns.flatMap((cc) => cc.adGroups.flatMap((ag) => ag.ads.map((ad) => ad.id))),
  );
  const kwIds = [
    ...campaigns.flatMap((c) =>
      c.channelCampaigns.flatMap((cc) => cc.adGroups.flatMap((ag) => ag.keywords.map((k) => k.id))),
    ),
    ...campaigns.flatMap((c) => c.channelCampaigns.flatMap((cc) => cc.negatives.map((n) => n.id))),
  ];

  const subjectPairs: Array<{ type: string; ids: string[] }> = [
    { type: "CAMPAIGN", ids: campaignIds },
    { type: "CHANNEL_CAMPAIGN", ids: ccIds },
    { type: "CHANNEL_AD_GROUP", ids: agIds },
    { type: "CHANNEL_AD", ids: adIds },
    { type: "CHANNEL_KEYWORD", ids: kwIds },
  ].filter((p) => p.ids.length > 0);

  console.log("campaigns to delete:");
  for (const c of campaigns) {
    const ccs = c.channelCampaigns.length;
    const ags = c.channelCampaigns.reduce((n, cc) => n + cc.adGroups.length, 0);
    const ads = c.channelCampaigns.reduce(
      (n, cc) => n + cc.adGroups.reduce((m, ag) => m + ag.ads.length, 0),
      0,
    );
    const kws = c.channelCampaigns.reduce(
      (n, cc) =>
        n + cc.negatives.length + cc.adGroups.reduce((m, ag) => m + ag.keywords.length, 0),
      0,
    );
    console.log(
      `  ${c.id}  status=${c.status}  name="${c.name}"  (cc=${ccs}, ag=${ags}, ad=${ads}, kw=${kws})`,
    );
  }

  const orOfPairs = (field: { t: string; i: string }) =>
    subjectPairs.map((p) => ({ [field.t]: p.type, [field.i]: { in: p.ids } }));

  const countChangeEvents = await prisma.changeEvent.count({
    where: { OR: orOfPairs({ t: "subjectType", i: "subjectId" }) },
  });
  const countAnnotations = await prisma.annotation.count({
    where: { OR: orOfPairs({ t: "subjectType", i: "subjectId" }) },
  });
  const countApprovals = await prisma.approval.count({
    where: { OR: orOfPairs({ t: "targetType", i: "targetId" }) },
  });
  const countSyncRuns = await prisma.syncRun.count({
    where: { OR: orOfPairs({ t: "targetType", i: "targetId" }) },
  });

  console.log("polymorphic rows that will also be removed:");
  console.log(`  ChangeEvent:  ${countChangeEvents}`);
  console.log(`  Annotation:   ${countAnnotations}`);
  console.log(`  Approval:     ${countApprovals}`);
  console.log(`  SyncRun:      ${countSyncRuns}`);

  if (!commit) {
    console.log("\n(dry-run — pass --yes to actually delete)");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const ce = await tx.changeEvent.deleteMany({
      where: { OR: orOfPairs({ t: "subjectType", i: "subjectId" }) },
    });
    const an = await tx.annotation.deleteMany({
      where: { OR: orOfPairs({ t: "subjectType", i: "subjectId" }) },
    });
    const ap = await tx.approval.deleteMany({
      where: { OR: orOfPairs({ t: "targetType", i: "targetId" }) },
    });
    const sr = await tx.syncRun.deleteMany({
      where: { OR: orOfPairs({ t: "targetType", i: "targetId" }) },
    });
    const cp = await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    return { ce, an, ap, sr, cp };
  });

  console.log("\ndeleted:");
  console.log(`  ChangeEvent:  ${result.ce.count}`);
  console.log(`  Annotation:   ${result.an.count}`);
  console.log(`  Approval:     ${result.ap.count}`);
  console.log(`  SyncRun:      ${result.sr.count}`);
  console.log(`  Campaign:     ${result.cp.count}  (cascade handled ChannelCampaign / AdGroup / Ad / Keyword + all per-level performance)`);
  logger.info({ ...result }, "campaigns deleted");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
