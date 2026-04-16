import { ulid } from "ulid";

// Prefixed ULIDs: sortable, unique, agent-friendly in free text.
// Example: cmp_01HXZ1K2N3P4Q5R6S7T8V9W0AB
export const ID_PREFIXES = {
  workspace: "wsp",
  brand: "brd",
  product: "prd",
  audienceSegment: "aud",
  actor: "act",
  initiative: "ini",
  hypothesis: "hyp",
  experiment: "exp",
  learning: "lrn",
  campaign: "cmp",
  channelCampaign: "ccp",
  channelAdGroup: "cag",
  asset: "ast",
  assetVersion: "ver",
  approval: "apr",
  syncRun: "syn",
  changeEvent: "chg",
  annotation: "ann",
  integrationAccount: "ica",
  channelConnection: "cnc",
  performance: "prf",
  outcome: "out",
  cluster: "clu",
  finding: "fnd",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function newId(kind: keyof typeof ID_PREFIXES): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`;
}

export function isId(prefix: IdPrefix, value: string): boolean {
  return value.startsWith(`${prefix}_`);
}
