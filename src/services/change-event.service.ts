import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import type { ChangeEventInput } from "../domain/events.js";

export class ChangeEventService {
  async append(input: ChangeEventInput): Promise<string> {
    const id = newId("changeEvent");
    await prisma.changeEvent.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actorId: input.actorId ?? null,
        kind: input.kind,
        summary: input.summary,
        payload: (input.payload ?? {}) as object,
        correctsId: input.correctsId ?? null,
      },
    });
    return id;
  }

  async listForSubject(workspaceId: string, subjectType: string, subjectId: string) {
    return prisma.changeEvent.findMany({
      where: { workspaceId, subjectType, subjectId },
      orderBy: { at: "asc" },
    });
  }

  async listInRange(workspaceId: string, from: Date, to: Date) {
    return prisma.changeEvent.findMany({
      where: { workspaceId, at: { gte: from, lte: to } },
      orderBy: { at: "asc" },
    });
  }
}

export const changeEventService = new ChangeEventService();
