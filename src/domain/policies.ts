import type { CampaignStatus, AssetVersionStatus, ActorRole } from "./status.js";

// Erlaubte Transitions für Campaigns.
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "DRAFT", "ARCHIVED"],
  APPROVED: ["SYNCED", "DRAFT", "ARCHIVED"],
  SYNCED: ["PAUSED", "ARCHIVED"],
  PAUSED: ["SYNCED", "ARCHIVED"],
  ARCHIVED: [],
};

export const ASSET_VERSION_TRANSITIONS: Record<AssetVersionStatus, AssetVersionStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "SUPERSEDED"],
  PUBLISHED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from].includes(to);
}

export function canTransitionAssetVersion(from: AssetVersionStatus, to: AssetVersionStatus): boolean {
  return ASSET_VERSION_TRANSITIONS[from].includes(to);
}

// Rollen-basierte Policy. MVP-Variante: grobkörnig.
export const ROLE_CAN_APPROVE: ActorRole[] = ["reviewer", "operator"];
export const ROLE_CAN_SYNC: ActorRole[] = ["media-buyer", "operator"];

export function canActorApprove(role: ActorRole, authorRole?: ActorRole): boolean {
  if (!ROLE_CAN_APPROVE.includes(role)) return false;
  // Autor darf sich nicht selbst approven (gilt in MVP rollenbasiert).
  if (authorRole && authorRole === role && role !== "operator") return false;
  return true;
}

export function canActorSync(role: ActorRole): boolean {
  return ROLE_CAN_SYNC.includes(role);
}
