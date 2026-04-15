// Statusmodelle als Union-Types. Spiegelbild der Prisma-Enums, aber
// explizit und in der Domain-Schicht primär.

export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SYNCED"
  | "PAUSED"
  | "ARCHIVED";

export type AssetVersionStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "SUPERSEDED";

export type InitiativeStatus =
  | "PROPOSED"
  | "ACTIVE"
  | "ON_HOLD"
  | "DONE"
  | "CANCELLED";

export type ExperimentStatus =
  | "DESIGN"
  | "RUNNING"
  | "ANALYZING"
  | "CONCLUDED"
  | "ABORTED";

export type ApprovalDecision =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type SyncRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIAL";

export type ActorRole =
  | "strategist"
  | "copywriter"
  | "analyst"
  | "reviewer"
  | "router"
  | "media-buyer"
  | "experiment-manager"
  | "operator";
