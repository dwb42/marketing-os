import { loadEnv } from "../../config/env.js";
import {
  ChannelConnector,
  ConnectionHandle,
  ConnectorError,
  IntegrationAccountRef,
  LevelPerformancePullResult,
  NormalizedLevelPerformanceRow,
  NormalizedPerformanceRow,
  PerformancePullResult,
  PullPerformanceInput,
  PulledAd,
  PulledAdGroup,
  PulledKeyword,
  PulledRsaAsset,
  PushCampaignInput,
  StructurePullResult,
  SyncRunResult,
} from "../types.js";
import { refreshAccessToken, type GoogleAdsTokens } from "./auth.js";

const BASE = "https://googleads.googleapis.com/v23";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Reads "adGroupAd.ad.id" etc from a nested JSON row returned by Google Ads.
function readNestedString(
  obj: Record<string, unknown>,
  path: string,
): string | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return cur == null ? null : String(cur);
}

function requireEnv(key: string): string {
  const env = loadEnv();
  const val = (env as unknown as Record<string, string | undefined>)[key];
  if (!val) throw new ConnectorError("AUTH", `${key} is not configured`);
  return val;
}

async function googleAdsRequest(
  method: string,
  url: string,
  accessToken: string,
  developerToken: string,
  body?: unknown,
  loginCustomerId?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) throw new ConnectorError("AUTH", `Google Ads 401: ${text}`);
    if (response.status === 429)
      throw new ConnectorError("RATE_LIMIT", `Google Ads 429: ${text}`, undefined, 60);
    throw new ConnectorError("TRANSIENT", `Google Ads ${response.status}: ${text}`);
  }

  return response.json();
}

export class GoogleAdsConnector implements ChannelConnector {
  readonly id = "google_ads" as const;

  private cachedTokens: GoogleAdsTokens | null = null;
  private accessToken: string | null = null;
  private developerToken: string | null = null;
  private loginCustomerId: string | undefined = undefined;

  async authenticate(account: IntegrationAccountRef): Promise<ConnectionHandle> {
    if (account.channel !== "google_ads") {
      throw new ConnectorError("VALIDATION", "Account channel mismatch");
    }

    const env = loadEnv();
    this.developerToken = requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
    this.loginCustomerId = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const customerId = requireEnv("GOOGLE_ADS_CUSTOMER_ID");

    if (this.cachedTokens && this.cachedTokens.expiresAt > new Date()) {
      this.accessToken = this.cachedTokens.accessToken;
      return {
        channel: "google_ads",
        accountId: customerId,
        expiresAt: this.cachedTokens.expiresAt,
      };
    }

    const clientId = requireEnv("GOOGLE_ADS_OAUTH_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_ADS_OAUTH_CLIENT_SECRET");
    const refreshToken = requireEnv("GOOGLE_ADS_REFRESH_TOKEN");

    this.cachedTokens = await refreshAccessToken(clientId, clientSecret, refreshToken);
    this.accessToken = this.cachedTokens.accessToken;

    return {
      channel: "google_ads",
      accountId: customerId,
      expiresAt: this.cachedTokens.expiresAt,
    };
  }

  async pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult> {
    this.ensureAuthenticated();
    const customerId = input.connection.accountId;

    const query = `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, segments.date FROM ad_group WHERE segments.date BETWEEN '${fmtDate(input.from)}' AND '${fmtDate(input.to)}' AND campaign.status != 'REMOVED'`;

    const data = (await googleAdsRequest(
      "POST",
      `${BASE}/customers/${customerId}/googleAds:searchStream`,
      this.accessToken!,
      this.developerToken!,
      { query },
      this.loginCustomerId,
    )) as Array<{ results?: Array<Record<string, unknown>> }>;

    const rows: NormalizedPerformanceRow[] = [];
    for (const batch of data) {
      if (!batch.results) continue;
      for (const row of batch.results) {
        const campaign = row.campaign as { id?: string; name?: string } | undefined;
        const adGroup = row.adGroup as { id?: string } | undefined;
        const metrics = row.metrics as Record<string, unknown> | undefined;
        const segments = row.segments as { date?: string } | undefined;

        if (!campaign?.id || !metrics || !segments?.date) continue;

        rows.push({
          externalCampaignId: String(campaign.id),
          externalAdGroupId: adGroup?.id ? String(adGroup.id) : undefined,
          date: new Date(segments.date),
          impressions: parseInt(String(metrics.impressions), 10) || 0,
          clicks: parseInt(String(metrics.clicks), 10) || 0,
          costMicros: BigInt(String(metrics.costMicros ?? "0")),
          conversions: parseFloat(String(metrics.conversions)) || 0,
          conversionValue: parseFloat(String(metrics.conversionsValue)) || 0,
          raw: row as Record<string, unknown>,
        });
      }
    }

    return { rows, pulledAt: new Date() };
  }

  async pushCampaign(input: PushCampaignInput): Promise<SyncRunResult> {
    this.ensureAuthenticated();
    const customerId = input.connection.accountId;
    const p = input.payload as {
      campaignName: string;
      headlines: string[];
      descriptions: string[];
      targetUrl: string;
      keywords: string[];
      negativeKeywords: string[];
    };

    const request = async (path: string, body: unknown) =>
      googleAdsRequest(
        "POST",
        `${BASE}${path}`,
        this.accessToken!,
        this.developerToken!,
        body,
        this.loginCustomerId,
      );

    // A — Campaign Budget
    const budgetRes = (await request(`/customers/${customerId}/campaignBudgets:mutate`, {
      operations: [
        {
          create: {
            name: `${p.campaignName} Budget`,
            amountMicros: "10000000",
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const budgetResource = budgetRes.results[0]!.resourceName;
    const budgetId = budgetResource.split("/").pop()!;

    // B — Campaign (PAUSED)
    const campaignRes = (await request(`/customers/${customerId}/campaigns:mutate`, {
      operations: [
        {
          create: {
            name: p.campaignName,
            advertisingChannelType: "SEARCH",
            status: "PAUSED",
            manualCpc: {},
            campaignBudget: budgetResource,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
            },
            geoTargetTypeSetting: {
              positiveGeoTargetType: "PRESENCE",
            },
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const campaignResource = campaignRes.results[0]!.resourceName;
    const campaignId = campaignResource.split("/").pop()!;

    // C — Geo-Targeting: Deutschland (2276)
    await request(`/customers/${customerId}/campaignCriteria:mutate`, {
      operations: [
        {
          create: {
            campaign: campaignResource,
            location: {
              geoTargetConstant: "geoTargetConstants/2276",
            },
          },
        },
      ],
    });

    // D — Ad Group
    const adGroupRes = (await request(`/customers/${customerId}/adGroups:mutate`, {
      operations: [
        {
          create: {
            name: `${p.campaignName} — Ad Group`,
            campaign: campaignResource,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: "2000000",
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const adGroupResource = adGroupRes.results[0]!.resourceName;
    const adGroupId = adGroupResource.split("/").pop()!;

    // E — RSA (Responsive Search Ad)
    const headlines = p.headlines.slice(0, 15).map((text) => ({
      text: text.slice(0, 30),
      pinnedField: null,
    }));
    const descriptions = p.descriptions.slice(0, 4).map((text) => ({
      text: text.slice(0, 90),
      pinnedField: null,
    }));

    await request(`/customers/${customerId}/adGroupAds:mutate`, {
      operations: [
        {
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            ad: {
              responsiveSearchAd: {
                headlines,
                descriptions,
                path1: "pflegegeld",
                path2: "hilfe",
              },
              finalUrls: [p.targetUrl],
            },
          },
        },
      ],
    });

    // F — Keywords (Phrase Match) with health policy exemption
    if (p.keywords.length > 0) {
      await request(`/customers/${customerId}/adGroupCriteria:mutate`, {
        operations: p.keywords.map((kw) => ({
          create: {
            adGroup: adGroupResource,
            keyword: {
              text: kw,
              matchType: "PHRASE",
            },
          },
          exemptPolicyViolationKeys: [
            { policyName: "HEALTH_IN_PERSONALIZED_ADS", violatingText: kw },
          ],
        })),
      });
    }

    // G — Negative Keywords (Campaign-Level, Broad Match)
    if (p.negativeKeywords.length > 0) {
      await request(`/customers/${customerId}/campaignCriteria:mutate`, {
        operations: p.negativeKeywords.map((nkw) => ({
          create: {
            campaign: campaignResource,
            negative: true,
            keyword: {
              text: nkw,
              matchType: "BROAD",
            },
          },
        })),
      });
    }

    return {
      externalIds: {
        campaignId,
        adGroupId,
        budgetId,
      },
      payload: { status: "PAUSED" },
    };
  }

  async getCampaignBudgetResource(
    customerId: string,
    externalCampaignId: string,
  ): Promise<string> {
    this.ensureAuthenticated();
    const query = `SELECT campaign.id, campaign.campaign_budget FROM campaign WHERE campaign.id = ${externalCampaignId}`;
    const data = (await googleAdsRequest(
      "POST",
      `${BASE}/customers/${customerId}/googleAds:searchStream`,
      this.accessToken!,
      this.developerToken!,
      { query },
      this.loginCustomerId,
    )) as Array<{ results?: Array<{ campaign?: { campaignBudget?: string } }> }>;
    for (const batch of data) {
      for (const row of batch.results ?? []) {
        const budget = row.campaign?.campaignBudget;
        if (budget) return budget;
      }
    }
    throw new ConnectorError("PERMANENT", `Budget for campaign ${externalCampaignId} not found`);
  }

  async updateCampaignBudget(
    customerId: string,
    budgetResource: string,
    amountMicros: bigint,
  ): Promise<void> {
    this.ensureAuthenticated();
    await googleAdsRequest(
      "POST",
      `${BASE}/customers/${customerId}/campaignBudgets:mutate`,
      this.accessToken!,
      this.developerToken!,
      {
        operations: [
          {
            update: {
              resourceName: budgetResource,
              amountMicros: amountMicros.toString(),
            },
            updateMask: "amount_micros",
          },
        ],
      },
      this.loginCustomerId,
    );
  }

  // ── Strukturelle Pulls ─────────────────────────────────────────

  private async searchStream(
    customerId: string,
    query: string,
  ): Promise<Array<Record<string, unknown>>> {
    this.ensureAuthenticated();
    const data = (await googleAdsRequest(
      "POST",
      `${BASE}/customers/${customerId}/googleAds:searchStream`,
      this.accessToken!,
      this.developerToken!,
      { query },
      this.loginCustomerId,
    )) as Array<{ results?: Array<Record<string, unknown>> }>;
    const rows: Array<Record<string, unknown>> = [];
    for (const batch of data) {
      if (batch.results) rows.push(...batch.results);
    }
    return rows;
  }

  async pullStructure(
    customerId: string,
    externalCampaignId: string,
  ): Promise<StructurePullResult> {
    // Ad Groups
    const adGroupRows = await this.searchStream(
      customerId,
      `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros ` +
        `FROM ad_group ` +
        `WHERE campaign.id = ${externalCampaignId} AND ad_group.status != 'REMOVED'`,
    );
    const adGroups: PulledAdGroup[] = [];
    for (const row of adGroupRows) {
      const ag = row.adGroup as
        | { id?: string; name?: string; status?: string; cpcBidMicros?: string }
        | undefined;
      if (!ag?.id) continue;
      adGroups.push({
        externalId: String(ag.id),
        name: ag.name ?? "",
        status: ag.status ?? "UNKNOWN",
        cpcBidMicros: ag.cpcBidMicros ?? null,
        raw: row,
      });
    }

    // Ads (RSA)
    const adRows = await this.searchStream(
      customerId,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status, ` +
        `ad_group_ad.policy_summary.approval_status, ` +
        `ad_group_ad.ad.responsive_search_ad.headlines, ` +
        `ad_group_ad.ad.responsive_search_ad.descriptions, ` +
        `ad_group_ad.ad.responsive_search_ad.path1, ` +
        `ad_group_ad.ad.responsive_search_ad.path2, ` +
        `ad_group_ad.ad.final_urls, ad_group.id ` +
        `FROM ad_group_ad ` +
        `WHERE campaign.id = ${externalCampaignId} AND ad_group_ad.status != 'REMOVED'`,
    );
    const ads: PulledAd[] = [];
    for (const row of adRows) {
      const aga = row.adGroupAd as
        | {
            ad?: {
              id?: string;
              type?: string;
              finalUrls?: string[];
              responsiveSearchAd?: {
                headlines?: Array<{ text?: string; pinnedField?: string | null }>;
                descriptions?: Array<{ text?: string; pinnedField?: string | null }>;
                path1?: string;
                path2?: string;
              };
            };
            status?: string;
            policySummary?: { approvalStatus?: string };
          }
        | undefined;
      const ag = row.adGroup as { id?: string } | undefined;
      const ad = aga?.ad;
      if (!ad?.id || !ag?.id) continue;
      const rsa = ad.responsiveSearchAd;
      const headlines: PulledRsaAsset[] = (rsa?.headlines ?? []).map((h) => ({
        text: h.text ?? "",
        pinnedField: h.pinnedField ?? null,
      }));
      const descriptions: PulledRsaAsset[] = (rsa?.descriptions ?? []).map((d) => ({
        text: d.text ?? "",
        pinnedField: d.pinnedField ?? null,
      }));
      ads.push({
        externalId: String(ad.id),
        externalAdGroupId: String(ag.id),
        type: ad.type ?? "RESPONSIVE_SEARCH_AD",
        status: aga?.status ?? "UNKNOWN",
        policyApprovalStatus: aga?.policySummary?.approvalStatus ?? null,
        headlines,
        descriptions,
        finalUrls: ad.finalUrls ?? [],
        path1: rsa?.path1 ?? null,
        path2: rsa?.path2 ?? null,
        raw: row,
      });
    }

    // AdGroup-Keywords (positiv + ad-group-level negatives)
    const kwRows = await this.searchStream(
      customerId,
      `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ` +
        `ad_group_criterion.keyword.match_type, ad_group_criterion.status, ` +
        `ad_group_criterion.cpc_bid_micros, ad_group_criterion.negative, ad_group.id ` +
        `FROM ad_group_criterion ` +
        `WHERE campaign.id = ${externalCampaignId} ` +
        `AND ad_group_criterion.type = KEYWORD ` +
        `AND ad_group_criterion.status != 'REMOVED'`,
    );
    const keywords: PulledKeyword[] = [];
    for (const row of kwRows) {
      const agc = row.adGroupCriterion as
        | {
            criterionId?: string;
            status?: string;
            cpcBidMicros?: string;
            negative?: boolean;
            keyword?: { text?: string; matchType?: string };
          }
        | undefined;
      const ag = row.adGroup as { id?: string } | undefined;
      if (!agc?.criterionId || !ag?.id || !agc.keyword?.text) continue;
      keywords.push({
        externalId: String(agc.criterionId),
        externalAdGroupId: String(ag.id),
        externalCampaignId: null,
        text: agc.keyword.text,
        matchType: agc.keyword.matchType ?? "PHRASE",
        negative: Boolean(agc.negative),
        status: agc.status ?? "UNKNOWN",
        cpcBidMicros: agc.cpcBidMicros ?? null,
        raw: row,
      });
    }

    // Campaign-level Negatives
    const negRows = await this.searchStream(
      customerId,
      `SELECT campaign_criterion.criterion_id, campaign_criterion.keyword.text, ` +
        `campaign_criterion.keyword.match_type, campaign_criterion.status, ` +
        `campaign_criterion.negative, campaign.id ` +
        `FROM campaign_criterion ` +
        `WHERE campaign.id = ${externalCampaignId} ` +
        `AND campaign_criterion.type = KEYWORD ` +
        `AND campaign_criterion.negative = TRUE`,
    );
    for (const row of negRows) {
      const cc = row.campaignCriterion as
        | {
            criterionId?: string;
            status?: string;
            negative?: boolean;
            keyword?: { text?: string; matchType?: string };
          }
        | undefined;
      if (!cc?.criterionId || !cc.keyword?.text) continue;
      keywords.push({
        externalId: String(cc.criterionId),
        externalAdGroupId: null,
        externalCampaignId: externalCampaignId,
        text: cc.keyword.text,
        matchType: cc.keyword.matchType ?? "BROAD",
        negative: true,
        status: cc.status ?? "UNKNOWN",
        cpcBidMicros: null,
        raw: row,
      });
    }

    return { adGroups, ads, keywords, pulledAt: new Date() };
  }

  private async pullLevelPerformance(
    customerId: string,
    externalCampaignId: string,
    from: Date,
    to: Date,
    opts: {
      fromResource: string;
      entityIdField: string; // e.g. "adGroupCriterion.criterionId"
      select: string;
    },
  ): Promise<LevelPerformancePullResult> {
    const rows = await this.searchStream(
      customerId,
      `SELECT ${opts.select}, ad_group.id, ` +
        `metrics.impressions, metrics.clicks, metrics.cost_micros, ` +
        `metrics.conversions, metrics.conversions_value, segments.date ` +
        `FROM ${opts.fromResource} ` +
        `WHERE segments.date BETWEEN '${fmtDate(from)}' AND '${fmtDate(to)}' ` +
        `AND campaign.id = ${externalCampaignId}`,
    );
    const out: NormalizedLevelPerformanceRow[] = [];
    for (const row of rows) {
      const metrics = row.metrics as Record<string, unknown> | undefined;
      const segments = row.segments as { date?: string } | undefined;
      if (!metrics || !segments?.date) continue;

      const entityId = readNestedString(row, opts.entityIdField);
      if (!entityId) continue;

      const ag = row.adGroup as { id?: string } | undefined;

      out.push({
        entityExternalId: entityId,
        externalAdGroupId: ag?.id ? String(ag.id) : undefined,
        date: new Date(segments.date),
        impressions: parseInt(String(metrics.impressions), 10) || 0,
        clicks: parseInt(String(metrics.clicks), 10) || 0,
        costMicros: BigInt(String(metrics.costMicros ?? "0")),
        conversions: parseFloat(String(metrics.conversions)) || 0,
        conversionValue: parseFloat(String(metrics.conversionsValue)) || 0,
        raw: row,
      });
    }
    return { rows: out, pulledAt: new Date() };
  }

  async pullAdGroupPerformance(
    customerId: string,
    externalCampaignId: string,
    from: Date,
    to: Date,
  ): Promise<LevelPerformancePullResult> {
    return this.pullLevelPerformance(customerId, externalCampaignId, from, to, {
      fromResource: "ad_group",
      entityIdField: "adGroup.id",
      select: "ad_group.id",
    });
  }

  async pullKeywordPerformance(
    customerId: string,
    externalCampaignId: string,
    from: Date,
    to: Date,
  ): Promise<LevelPerformancePullResult> {
    return this.pullLevelPerformance(customerId, externalCampaignId, from, to, {
      fromResource: "keyword_view",
      entityIdField: "adGroupCriterion.criterionId",
      select: "ad_group_criterion.criterion_id",
    });
  }

  async pullAdPerformance(
    customerId: string,
    externalCampaignId: string,
    from: Date,
    to: Date,
  ): Promise<LevelPerformancePullResult> {
    return this.pullLevelPerformance(customerId, externalCampaignId, from, to, {
      fromResource: "ad_group_ad",
      entityIdField: "adGroupAd.ad.id",
      select: "ad_group_ad.ad.id",
    });
  }

  private ensureAuthenticated(): void {
    if (!this.accessToken || !this.developerToken) {
      throw new ConnectorError("AUTH", "Not authenticated — call authenticate() first");
    }
    if (this.cachedTokens && this.cachedTokens.expiresAt <= new Date()) {
      throw new ConnectorError("AUTH", "Access token expired — call authenticate() again");
    }
  }
}

export const googleAdsConnector = new GoogleAdsConnector();
