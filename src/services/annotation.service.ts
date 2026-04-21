import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";

export class AnnotationService {
  async create(input: {
    workspaceId: string;
    subjectType: string;
    subjectId: string;
    body: string;
    occurredAt: Date;
    pinned?: boolean;
    actorId?: string;
  }): Promise<string> {
    const id = newId("annotation");
    await prisma.annotation.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        body: input.body,
        occurredAt: input.occurredAt,
        pinned: input.pinned ?? false,
        actorId: input.actorId ?? null,
      },
    });
    return id;
  }

  async get(workspaceId: string, id: string) {
    const a = await prisma.annotation.findFirst({ where: { id, workspaceId } });
    if (!a) throw notFound("Annotation", id);
    return a;
  }

  async update(params: {
    workspaceId: string;
    id: string;
    patch: { body?: string; pinned?: boolean; occurredAt?: Date };
    actorId?: string;
    reason?: string;
  }) {
    const existing = await prisma.annotation.findFirst({
      where: { id: params.id, workspaceId: params.workspaceId },
    });
    if (!existing) throw notFound("Annotation", params.id);
    const data: Record<string, unknown> = {};
    if (params.patch.body !== undefined) data.body = params.patch.body;
    if (params.patch.pinned !== undefined) data.pinned = params.patch.pinned;
    if (params.patch.occurredAt !== undefined) data.occurredAt = params.patch.occurredAt;
    if (Object.keys(data).length === 0) {
      throw invalidInput("PATCH body must contain at least one field");
    }
    const before = { body: existing.body, pinned: existing.pinned, occurredAt: existing.occurredAt };
    const updated = await prisma.annotation.update({ where: { id: params.id }, data });
    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "ANNOTATION",
      subjectId: params.id,
      actorId: params.actorId,
      kind: "annotation.patched",
      summary: `Annotation patched (${Object.keys(data).join(", ")})`,
      payload: {
        before: Object.fromEntries(Object.keys(data).map((k) => [k, (before as Record<string, unknown>)[k]])),
        after: Object.fromEntries(Object.keys(data).map((k) => [k, (updated as unknown as Record<string, unknown>)[k]])),
        reason: params.reason ?? null,
      },
    });
    return updated;
  }

  async delete(params: {
    workspaceId: string;
    id: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const existing = await prisma.annotation.findFirst({
      where: { id: params.id, workspaceId: params.workspaceId },
    });
    if (!existing) throw notFound("Annotation", params.id);
    const correctsId = newId("changeEvent");
    await prisma.$transaction([
      prisma.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "ANNOTATION",
          subjectId: params.id,
          actorId: params.actorId ?? null,
          kind: "annotation.deleted",
          summary: `Annotation on ${existing.subjectType}:${existing.subjectId} deleted`,
          correctsId: params.id,
          payload: {
            subjectType: existing.subjectType,
            subjectId: existing.subjectId,
            body: existing.body,
            pinned: existing.pinned,
            reason: params.reason ?? null,
          },
        },
      }),
      prisma.annotation.delete({ where: { id: params.id } }),
    ]);
    return { deleted: true, correctsId };
  }

  async listForSubject(workspaceId: string, subjectType: string, subjectId: string) {
    return prisma.annotation.findMany({
      where: { workspaceId, subjectType, subjectId },
      orderBy: { occurredAt: "asc" },
    });
  }

  async listForWorkspace(
    workspaceId: string,
    filter: { pinned?: boolean; subjectType?: string } = {},
  ) {
    return prisma.annotation.findMany({
      where: {
        workspaceId,
        ...(filter.pinned !== undefined ? { pinned: filter.pinned } : {}),
        ...(filter.subjectType ? { subjectType: filter.subjectType } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });
  }
}

export const annotationService = new AnnotationService();
