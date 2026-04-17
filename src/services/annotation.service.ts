import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";

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
