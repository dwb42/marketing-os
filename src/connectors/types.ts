// Einheitliches Connector-Interface für externe Kanäle.
// Services oberhalb kennen keine kanalspezifischen Details.

export type ChannelId = "google_ads" | "meta_ads";

export interface IntegrationAccountRef {
  id: string;
  channel: ChannelId;
  externalId: string;
  credentialsEncrypted: string;
}

export interface ConnectionHandle {
  channel: ChannelId;
  accountId: string;
  expiresAt?: Date;
}

export interface PullPerformanceInput {
  connection: ConnectionHandle;
  from: Date;
  to: Date;
  channelCampaignExternalIds?: string[];
}

export interface NormalizedPerformanceRow {
  externalCampaignId: string;
  externalAdGroupId?: string;
  date: Date;
  impressions: number;
  clicks: number;
  costMicros: bigint;
  conversions: number;
  conversionValue: number;
  raw: Record<string, unknown>;
}

export interface PerformancePullResult {
  rows: NormalizedPerformanceRow[];
  pulledAt: Date;
}

export interface PushCampaignInput {
  connection: ConnectionHandle;
  internalCampaignId: string;
  payload: Record<string, unknown>;
}

export interface PushAssetVersionInput {
  connection: ConnectionHandle;
  internalAssetVersionId: string;
  payload: Record<string, unknown>;
}

export interface SyncRunResult {
  externalIds: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface ChannelConnector {
  readonly id: ChannelId;

  authenticate(account: IntegrationAccountRef): Promise<ConnectionHandle>;
  pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult>;
  pushCampaign?(input: PushCampaignInput): Promise<SyncRunResult>;
  pushAssetVersion?(input: PushAssetVersionInput): Promise<SyncRunResult>;
}

// Einheitliche Fehlerklasse für Connectors. Services oberhalb reagieren
// nur auf `kind`, nicht auf konkrete HTTP-Codes oder Exceptions.
export type ConnectorErrorKind =
  | "AUTH"
  | "RATE_LIMIT"
  | "VALIDATION"
  | "TRANSIENT"
  | "PERMANENT";

export class ConnectorError extends Error {
  constructor(
    public readonly kind: ConnectorErrorKind,
    message: string,
    public readonly cause?: unknown,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}
