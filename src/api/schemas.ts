import { z } from "zod";

// Gemeinsame, wiederverwendbare Schemas für die API.
// Diese werden sowohl zur Validierung als auch zur Typ-Ableitung in Services genutzt.

export const WorkspaceIdSchema = z.string().startsWith("wsp_");
export const ProductIdSchema = z.string().startsWith("prd_");
export const CampaignIdSchema = z.string().startsWith("cmp_");
export const AssetIdSchema = z.string().startsWith("ast_");
export const AssetVersionIdSchema = z.string().startsWith("ver_");
export const InitiativeIdSchema = z.string().startsWith("ini_");

export const CampaignStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SYNCED",
  "PAUSED",
  "ARCHIVED",
]);

export const CreateCampaignSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  productId: ProductIdSchema,
  name: z.string().min(1).max(200),
  objective: z.string().min(1).max(500),
  initiativeId: InitiativeIdSchema.optional(),
  audienceSegmentId: z.string().startsWith("aud_").optional(),
  actorId: z.string().optional(),
});

export const TransitionCampaignSchema = z.object({
  to: CampaignStatusSchema,
  actorId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export const CreateAssetSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  kind: z.enum([
    "HEADLINE_SET",
    "DESCRIPTION_SET",
    "IMAGE",
    "VIDEO",
    "LANDING_PAGE",
    "TEXT_BLOCK",
  ]),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  actorId: z.string().optional(),
});

export const AddAssetVersionSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  content: z.unknown(),
  actorId: z.string().optional(),
});

export const CreateApprovalSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  targetType: z.string(),
  targetId: z.string(),
  decision: z.enum(["REQUESTED", "APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  comment: z.string().max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
  actorId: z.string().optional(),
});

export const IngestOutcomeSchema = z.object({
  productId: ProductIdSchema,
  type: z.string().min(1).max(100),
  occurredAt: z.coerce.date(),
  sessionRef: z.string().optional(),
  attribution: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const CreateInitiativeSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(1000),
  actorId: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  modules: z.array(z.string()).optional(),
  outcomeLadder: z.array(z.string()).optional(),
  hypothesis: z.string().max(2000).optional(),
  learnQuestions: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  successCriteria: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});
