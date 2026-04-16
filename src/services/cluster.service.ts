import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";

type ClusterValidation = "HYPOTHESIS" | "WEAK_EVIDENCE" | "EVIDENCED" | "REFUTED";
type ClusterStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

export class ClusterService {
  async create(input: {
    workspaceId: string;
    productId: string;
    name: string;
    modulPrimary: string;
    initiativeId?: string;
    modulSecondary?: string[];
    outcome?: string;
    lebenslage?: string;
    suchbegriffe?: string[];
    naechsteAktion?: string;
    friktionspunkte?: string[];
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<string> {
    const id = newId("cluster");
    await prisma.intentCluster.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        productId: input.productId,
        initiativeId: input.initiativeId ?? null,
        name: input.name,
        modulPrimary: input.modulPrimary,
        modulSecondary: input.modulSecondary ?? [],
        outcome: input.outcome ?? null,
        lebenslage: input.lebenslage ?? null,
        suchbegriffe: input.suchbegriffe ?? [],
        naechsteAktion: input.naechsteAktion ?? null,
        friktionspunkte: input.friktionspunkte ?? [],
        metadata: (input.metadata ?? {}) as object,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "INTENT_CLUSTER",
      subjectId: id,
      actorId: input.actorId,
      kind: "cluster.created",
      summary: `IntentCluster "${input.name}" created`,
      payload: { modulPrimary: input.modulPrimary },
    });
    return id;
  }

  async update(
    workspaceId: string,
    id: string,
    fields: Partial<{
      name: string;
      modulPrimary: string;
      modulSecondary: string[];
      outcome: string;
      lebenslage: string;
      suchbegriffe: string[];
      naechsteAktion: string;
      friktionspunkte: string[];
      metadata: Record<string, unknown>;
      initiativeId: string;
      status: ClusterStatus;
    }>,
    actorId?: string,
  ): Promise<void> {
    const existing = await prisma.intentCluster.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("IntentCluster", id);
    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.modulPrimary !== undefined) data.modulPrimary = fields.modulPrimary;
    if (fields.modulSecondary !== undefined) data.modulSecondary = fields.modulSecondary;
    if (fields.outcome !== undefined) data.outcome = fields.outcome;
    if (fields.lebenslage !== undefined) data.lebenslage = fields.lebenslage;
    if (fields.suchbegriffe !== undefined) data.suchbegriffe = fields.suchbegriffe;
    if (fields.naechsteAktion !== undefined) data.naechsteAktion = fields.naechsteAktion;
    if (fields.friktionspunkte !== undefined) data.friktionspunkte = fields.friktionspunkte;
    if (fields.metadata !== undefined) data.metadata = fields.metadata as object;
    if (fields.initiativeId !== undefined) data.initiativeId = fields.initiativeId;
    if (fields.status !== undefined) data.status = fields.status;
    await prisma.intentCluster.update({ where: { id }, data });
    await changeEventService.append({
      workspaceId,
      subjectType: "INTENT_CLUSTER",
      subjectId: id,
      actorId,
      kind: "cluster.updated",
      summary: `IntentCluster updated: ${Object.keys(fields).join(", ")}`,
      payload: fields as Record<string, unknown>,
    });
  }

  async setValidation(
    workspaceId: string,
    id: string,
    validation: ClusterValidation,
    actorId?: string,
  ): Promise<void> {
    const existing = await prisma.intentCluster.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("IntentCluster", id);
    const from = existing.validation;
    await prisma.intentCluster.update({ where: { id }, data: { validation } });
    await changeEventService.append({
      workspaceId,
      subjectType: "INTENT_CLUSTER",
      subjectId: id,
      actorId,
      kind: "cluster.validation_changed",
      summary: `Validation ${from} → ${validation}`,
      payload: { from, to: validation },
    });
  }

  async list(
    workspaceId: string,
    filter: { productId?: string; status?: ClusterStatus; validation?: ClusterValidation; initiativeId?: string } = {},
  ) {
    return prisma.intentCluster.findMany({
      where: {
        workspaceId,
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.validation ? { validation: filter.validation } : {}),
        ...(filter.initiativeId ? { initiativeId: filter.initiativeId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(workspaceId: string, id: string) {
    const c = await prisma.intentCluster.findFirst({
      where: { id, workspaceId },
      include: { findings: true },
    });
    if (!c) throw notFound("IntentCluster", id);
    return c;
  }
}

export const clusterService = new ClusterService();
