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

export const AudienceSegmentIdSchema = z.string().startsWith("aud_");

export const ActorIdSchema = z.string().min(1).max(200);
export const ReasonSchema = z.string().max(500);
export const CampaignAssetRoleSchema = z.string().min(1).max(100);

export const LinkCampaignAssetSchema = z.object({
  assetId: AssetIdSchema,
  role: CampaignAssetRoleSchema,
  actorId: ActorIdSchema.optional(),
  reason: ReasonSchema.optional(),
});

export const PatchCampaignSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    objective: z.string().min(1).max(500).optional(),
    initiativeId: InitiativeIdSchema.nullable().optional(),
    audienceSegmentId: AudienceSegmentIdSchema.nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    actorId: ActorIdSchema.optional(),
    reason: ReasonSchema.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.objective !== undefined ||
      v.initiativeId !== undefined ||
      v.audienceSegmentId !== undefined ||
      v.startsAt !== undefined ||
      v.endsAt !== undefined,
    { message: "PATCH body must contain at least one mutable field" },
  );

export const DeleteCampaignQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: ActorIdSchema.optional(),
  reason: ReasonSchema.optional(),
});

export const DeleteProposalQuerySchema = DeleteCampaignQuerySchema;

export const ReSyncCampaignSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: ActorIdSchema.optional(),
  reason: ReasonSchema.optional(),
});

// ── Generic workspace-scoped body patterns ──

export const ActorReasonBody = z.object({
  workspaceId: WorkspaceIdSchema,
  actorId: ActorIdSchema.optional(),
  reason: ReasonSchema.optional(),
});

// ── Assets (P2) ──

export const AssetKindSchema = z.enum([
  "HEADLINE_SET",
  "DESCRIPTION_SET",
  "IMAGE",
  "VIDEO",
  "LANDING_PAGE",
  "TEXT_BLOCK",
]);

export const PatchAssetSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    actorId: ActorIdSchema.optional(),
    reason: ReasonSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "PATCH body must contain at least one mutable field",
  });

export const PatchAssetVersionContentSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  content: z.unknown(),
  actorId: ActorIdSchema.optional(),
  reason: ReasonSchema.optional(),
});

// ── Initiatives (P2) ──

export const PatchInitiativeSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    goal: z.string().min(1).max(1000).optional(),
    hypothesis: z.string().max(2000).nullable().optional(),
    successCriteria: z.string().max(2000).nullable().optional(),
    modules: z.array(z.string()).optional(),
    outcomeLadder: z.array(z.string()).optional(),
    learnQuestions: z.array(z.string()).optional(),
    assumptions: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
    actorId: ActorIdSchema.optional(),
    reason: ReasonSchema.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.goal !== undefined ||
      v.hypothesis !== undefined ||
      v.successCriteria !== undefined ||
      v.modules !== undefined ||
      v.outcomeLadder !== undefined ||
      v.learnQuestions !== undefined ||
      v.assumptions !== undefined ||
      v.risks !== undefined ||
      v.startsAt !== undefined ||
      v.endsAt !== undefined ||
      v.metadata !== undefined,
    { message: "PATCH body must contain at least one mutable field" },
  );

// ── Annotations (P2) ──

export const PatchAnnotationSchema = z
  .object({
    body: z.string().min(1).max(4000).optional(),
    pinned: z.boolean().optional(),
    occurredAt: z.coerce.date().optional(),
    actorId: ActorIdSchema.optional(),
    reason: ReasonSchema.optional(),
  })
  .refine(
    (v) => v.body !== undefined || v.pinned !== undefined || v.occurredAt !== undefined,
    { message: "PATCH body must contain at least one mutable field" },
  );

// ── Proposals (P2) ──

export const PatchProposalSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    rationale: z.string().min(1).max(4000).optional(),
    impact: z.string().max(2000).nullable().optional(),
    examples: z.array(z.string()).optional(),
    actorId: ActorIdSchema.optional(),
    reason: ReasonSchema.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.rationale !== undefined ||
      v.impact !== undefined ||
      v.examples !== undefined,
    { message: "PATCH body must contain at least one mutable field" },
  );

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
