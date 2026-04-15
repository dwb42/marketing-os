import {
  ChannelConnector,
  ConnectionHandle,
  ConnectorError,
  IntegrationAccountRef,
  NormalizedPerformanceRow,
  PerformancePullResult,
  PullPerformanceInput,
} from "../types.js";

// Google Ads Connector — Phase 1 Skeleton.
// Echte API-Aufrufe kommen in Phase 3. Das Interface ist jetzt schon fix,
// damit Services oberhalb (daily-performance-pull, sync-run-processor)
// gegen einen stabilen Vertrag bauen können.
export class GoogleAdsConnector implements ChannelConnector {
  readonly id = "google_ads" as const;

  async authenticate(account: IntegrationAccountRef): Promise<ConnectionHandle> {
    // Phase 3: OAuth2 Refresh-Token → Access-Token holen, Expiry berechnen.
    if (account.channel !== "google_ads") {
      throw new ConnectorError("VALIDATION", "Account channel mismatch");
    }
    return {
      channel: "google_ads",
      accountId: account.externalId,
    };
  }

  async pullPerformance(_input: PullPerformanceInput): Promise<PerformancePullResult> {
    // Phase 3: GAQL gegen Google Ads API, Mapping auf NormalizedPerformanceRow.
    // Stub bis dahin:
    const rows: NormalizedPerformanceRow[] = [];
    return { rows, pulledAt: new Date() };
  }
}

export const googleAdsConnector = new GoogleAdsConnector();
