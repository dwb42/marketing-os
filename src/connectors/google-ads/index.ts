import { loadEnv } from "../../config/env.js";
import {
  ChannelConnector,
  ConnectionHandle,
  ConnectorError,
  IntegrationAccountRef,
  NormalizedPerformanceRow,
  PerformancePullResult,
  PullPerformanceInput,
  PushCampaignInput,
  SyncRunResult,
} from "../types.js";
import { refreshAccessToken, type GoogleAdsTokens } from "./auth.js";

const BASE = "https://googleads.googleapis.com/v18";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function requireEnv(key: string): string {
  const env = loadEnv();
  const val = (env as unknown as Record<string, string | undefined>)[key];
  if (!val) throw new ConnectorError("AUTH", `${key} is not configured`);
  return val;
}

async function gadsRequest(
  path: string,
  accessToken: string,
  developerToken: string,
  body: unknown,
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

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    throw new ConnectorError("AUTH", `Google Ads API 401: ${await res.text()}`);
  }
  if (res.status === 429) {
    const retry = res.headers.get("retry-after");
    throw new ConnectorError(
      "RATE_LIMIT",
      "Google Ads API rate limit",
      undefined,
      retry ? parseInt(retry, 10) : 60,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ConnectorError("TRANSIENT", `Google Ads API ${res.status}: ${text}`);
  }
  return res.json();
}

export class GoogleAdsConnector implements ChannelConnector {
  readonly id = "google_ads" as const;

  private cachedTokens: GoogleAdsTokens | null = null;

  async authenticate(account: IntegrationAccountRef): Promise<ConnectionHandle> {
    if (account.channel !== "google_ads") {
      throw new ConnectorError("VALIDATION", "Account channel mismatch");
    }

    if (this.cachedTokens && this.cachedTokens.expiresAt > new Date()) {
      return {
        channel: "google_ads",
        accountId: account.externalId,
        expiresAt: this.cachedTokens.expiresAt,
      };
    }

    const clientId = requireEnv("GOOGLE_ADS_OAUTH_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_ADS_OAUTH_CLIENT_SECRET");
    const refreshToken = requireEnv("GOOGLE_ADS_REFRESH_TOKEN");

    this.cachedTokens = await refreshAccessToken(clientId, clientSecret, refreshToken);

    return {
      channel: "google_ads",
      accountId: account.externalId,
      expiresAt: this.cachedTokens.expiresAt,
    };
  }

  async pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult> {
    const accessToken = this.getAccessToken();
    const developerToken = requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
    const env = loadEnv();
    const customerId = input.connection.accountId;

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        segments.date
      FROM ad_group
      WHERE segments.date BETWEEN '${fmtDate(input.from)}' AND '${fmtDate(input.to)}'
        AND campaign.status != 'REMOVED'
    `.trim();

    const data = (await gadsRequest(
      `/customers/${customerId}/googleAds:searchStream`,
      accessToken,
      developerToken,
      { query },
      env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
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
          impressions: Number(metrics.impressions ?? 0),
          clicks: Number(metrics.clicks ?? 0),
          costMicros: BigInt(String(metrics.costMicros ?? "0")),
          conversions: Number(metrics.conversions ?? 0),
          conversionValue: Number(metrics.conversionsValue ?? 0),
          raw: row as Record<string, unknown>,
        });
      }
    }

    return { rows, pulledAt: new Date() };
  }

  async pushCampaign(input: PushCampaignInput): Promise<SyncRunResult> {
    const accessToken = this.getAccessToken();
    const developerToken = requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
    const env = loadEnv();
    const customerId = input.connection.accountId;
    const loginCustomerId = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const p = input.payload as {
      campaignName: string;
      headlines: string[];
      descriptions: string[];
      targetUrl: string;
      keywords: string[];
      negativeKeywords: string[];
    };

    const request = async (path: string, body: unknown) =>
      gadsRequest(path, accessToken, developerToken, body, loginCustomerId);

    const budgetRes = (await request(`/customers/${customerId}/campaignBudgets:mutate`, {
      operations: [
        {
          create: {
            name: `${p.campaignName} Budget`,
            amountMicros: "10000000",
            deliveryMethod: "STANDARD",
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const budgetResource = budgetRes.results[0]!.resourceName;

    const campaignRes = (await request(`/customers/${customerId}/campaigns:mutate`, {
      operations: [
        {
          create: {
            name: p.campaignName,
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            manualCpc: {},
            campaignBudget: budgetResource,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const campaignResource = campaignRes.results[0]!.resourceName;
    const campaignId = campaignResource.split("/").pop()!;

    // Geo-Targeting: Deutschland (ID 2276)
    await request(`/customers/${customerId}/campaignCriteria:mutate`, {
      operations: [
        {
          create: {
            campaign: campaignResource,
            location: { geoTargetConstant: `geoTargetConstants/2276` },
          },
        },
      ],
    });

    const adGroupRes = (await request(`/customers/${customerId}/adGroups:mutate`, {
      operations: [
        {
          create: {
            name: `${p.campaignName} — Ad Group`,
            campaign: campaignResource,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: "1000000",
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const adGroupResource = adGroupRes.results[0]!.resourceName;
    const adGroupId = adGroupResource.split("/").pop()!;

    const headlines = p.headlines.slice(0, 15).map((text) => ({
      text: text.slice(0, 30),
    }));
    const descriptions = p.descriptions.slice(0, 4).map((text) => ({
      text: text.slice(0, 90),
    }));

    const adRes = (await request(`/customers/${customerId}/adGroupAds:mutate`, {
      operations: [
        {
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            ad: {
              responsiveSearchAd: { headlines, descriptions },
              finalUrls: [p.targetUrl],
            },
          },
        },
      ],
    })) as { results: Array<{ resourceName: string }> };
    const adResource = adRes.results[0]!.resourceName;
    const adId = adResource.split("/").pop()!;

    if (p.keywords.length > 0) {
      await request(`/customers/${customerId}/adGroupCriteria:mutate`, {
        operations: p.keywords.map((kw) => ({
          create: {
            adGroup: adGroupResource,
            keyword: { text: kw, matchType: "PHRASE" },
          },
        })),
      });
    }

    if (p.negativeKeywords.length > 0) {
      await request(`/customers/${customerId}/campaignCriteria:mutate`, {
        operations: p.negativeKeywords.map((kw) => ({
          create: {
            campaign: campaignResource,
            negative: true,
            keyword: { text: kw, matchType: "BROAD" },
          },
        })),
      });
    }

    return {
      externalIds: {
        campaignId,
        adGroupId,
        adId,
        campaignResource,
        adGroupResource,
        budgetResource,
      },
    };
  }

  private getAccessToken(): string {
    if (!this.cachedTokens || this.cachedTokens.expiresAt <= new Date()) {
      throw new ConnectorError("AUTH", "Not authenticated — call authenticate() first");
    }
    return this.cachedTokens.accessToken;
  }
}

export const googleAdsConnector = new GoogleAdsConnector();
