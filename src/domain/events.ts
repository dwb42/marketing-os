// ChangeEvent: append-only Domain-Event. Polymorph über (subjectType, subjectId).
// Emittiert von Services bei jeder relevanten Zustandsänderung.

export type SubjectType =
  | "CAMPAIGN"
  | "CHANNEL_CAMPAIGN"
  | "CHANNEL_AD_GROUP"
  | "CHANNEL_AD"
  | "CHANNEL_KEYWORD"
  | "ASSET"
  | "ASSET_VERSION"
  | "INITIATIVE"
  | "EXPERIMENT"
  | "HYPOTHESIS"
  | "LEARNING"
  | "APPROVAL"
  | "SYNC_RUN"
  | "INTENT_CLUSTER"
  | "FINDING"
  | "PLATFORM"
  | "PROPOSAL";

export interface ChangeEventInput {
  workspaceId: string;
  subjectType: SubjectType;
  subjectId: string;
  actorId?: string;
  kind: string; // z.B. "campaign.transitioned", "asset.version_created"
  summary: string;
  payload?: Record<string, unknown>;
  correctsId?: string;
}
