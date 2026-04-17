// Types mirror the Prisma schema from marketing-os backend.
// Kept loose where the backend returns Json / Decimal fields.

export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SYNCED"
  | "PAUSED"
  | "ARCHIVED";

export type InitiativeStatus =
  | "PROPOSED"
  | "ACTIVE"
  | "ON_HOLD"
  | "DONE"
  | "CANCELLED";

export type ClusterStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
export type ClusterValidation =
  | "HYPOTHESIS"
  | "WEAK_EVIDENCE"
  | "EVIDENCED"
  | "REFUTED";

export type FindingStatus = "OPEN" | "ADDRESSED" | "WONT_FIX" | "ARCHIVED";
export type FindingConfidence = "LOW" | "MEDIUM" | "HIGH";

export type SyncRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIAL";
export type SyncRunType =
  | "PULL_PERFORMANCE"
  | "PUSH_CAMPAIGN"
  | "PUSH_ASSET_VERSION";

export type ChannelId = "GOOGLE_ADS" | "META_ADS";

export type AssetKind =
  | "HEADLINE_SET"
  | "DESCRIPTION_SET"
  | "IMAGE"
  | "VIDEO"
  | "LANDING_PAGE"
  | "TEXT_BLOCK";

export type AssetVersionStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "SUPERSEDED";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  brandId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  productId: string;
  initiativeId: string | null;
  audienceSegmentId: string | null;
  name: string;
  objective: string;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByActorId: string | null;
  // Relations (may be included by service):
  product?: Product;
  initiative?: Initiative;
  channelCampaigns?: ChannelCampaign[];
  campaignAssets?: Array<{
    campaignId: string;
    assetId: string;
    role: string;
    asset?: Asset;
  }>;
}

export interface ChannelCampaign {
  id: string;
  workspaceId: string;
  campaignId: string;
  channel: ChannelId;
  channelConnectionId: string | null;
  externalId: string | null;
  externalName: string | null;
  status: CampaignStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Initiative {
  id: string;
  workspaceId: string;
  title: string;
  goal: string;
  status: InitiativeStatus;
  startsAt: string | null;
  endsAt: string | null;
  modules: string[];
  outcomeLadder: unknown;
  hypothesis: string | null;
  learnQuestions: unknown;
  assumptions: unknown;
  risks: unknown;
  successCriteria: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IntentCluster {
  id: string;
  workspaceId: string;
  productId: string;
  initiativeId: string | null;
  name: string;
  status: ClusterStatus;
  validation: ClusterValidation;
  modulPrimary: string;
  modulSecondary: string[];
  outcome: string | null;
  lebenslage: string | null;
  suchbegriffe: string[];
  naechsteAktion: string | null;
  friktionspunkte: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  findings?: Finding[];
}

export interface Finding {
  id: string;
  workspaceId: string;
  initiativeId: string | null;
  clusterId: string | null;
  modulBetroffen: string | null;
  outcomeBetroffen: string | null;
  beobachtung: string;
  interpretation: string;
  konfidenz: FindingConfidence;
  konfidenzGrund: string | null;
  empfehlung: string;
  empfehlungAn: string | null;
  datenLuecke: string | null;
  status: FindingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  workspaceId: string;
  kind: AssetKind;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: AssetVersion[];
}

export interface AssetVersion {
  id: string;
  assetId: string;
  versionNum: number;
  status: AssetVersionStatus;
  content: unknown;
  contentHash: string;
  authorActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  workspaceId: string;
  targetType: string;
  targetId: string;
  decision: "REQUESTED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  comment: string | null;
  payload: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
}

export interface SyncRun {
  id: string;
  workspaceId: string;
  channel: ChannelId;
  type: SyncRunType;
  targetType: string;
  targetId: string;
  status: SyncRunStatus;
  idempotencyKey: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorKind: string | null;
  errorMessage: string | null;
  attempt: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ChangeEvent {
  id: string;
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  actorId: string | null;
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
  correctsId: string | null;
  at: string;
}

export interface Annotation {
  id: string;
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  body: string;
  pinned: boolean;
  actorId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface PerformanceRow {
  id: string;
  channelCampaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  costMicros: string; // BigInt serialized as string
  conversions: string | number;
  conversionValue: string | number;
  raw: Record<string, unknown>;
  pulledAt: string;
  syncRunId: string | null;
}

export interface OutcomeEvent {
  id: string;
  productId: string;
  type: string;
  occurredAt: string;
  sessionRef: string | null;
  attribution: Record<string, unknown>;
  payload: Record<string, unknown>;
  ingestedAt: string;
}

export interface FunnelResponse {
  funnel: Array<{ type: string; count: number }>;
}

export interface Learning {
  id: string;
  workspaceId: string;
  initiativeId: string | null;
  hypothesisId: string | null;
  experimentId: string | null;
  statement: string;
  confidence: FindingConfidence;
  evidence: unknown;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  campaigns: Campaign[];
  assets: Asset[];
  clusters: IntentCluster[];
  findings: Finding[];
  learnings: Learning[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
