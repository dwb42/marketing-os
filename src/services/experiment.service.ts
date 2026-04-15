import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";
import type { ExperimentStatus } from "../domain/status.js";

export class ExperimentService {
  async design(input: {
    workspaceId: string;
    title: string;
    description?: string;
    hypothesisId?: string;
    actorId?: string;
  }): Promise<string> {
    const id = newId("experiment");
    await prisma.experiment.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description ?? null,
        hypothesisId: input.hypothesisId ?? null,
        status: "DESIGN",
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "EXPERIMENT",
      subjectId: id,
      actorId: input.actorId,
      kind: "experiment.designed",
      summary: `Experiment "${input.title}" in DESIGN`,
    });
    return id;
  }

  async start(workspaceId: string, id: string, actorId?: string) {
    await this.setStatus(workspaceId, id, "RUNNING", actorId, { startedAt: new Date() });
  }

  async conclude(workspaceId: string, id: string, conclusion: string, actorId?: string) {
    await this.setStatus(workspaceId, id, "CONCLUDED", actorId, {
      endedAt: new Date(),
      conclusion,
    });
  }

  async abort(workspaceId: string, id: string, reason: string, actorId?: string) {
    await this.setStatus(workspaceId, id, "ABORTED", actorId, {
      endedAt: new Date(),
      conclusion: `ABORTED: ${reason}`,
    });
  }

  private async setStatus(
    workspaceId: string,
    id: string,
    status: ExperimentStatus,
    actorId: string | undefined,
    patch: { startedAt?: Date; endedAt?: Date; conclusion?: string } = {},
  ) {
    const existing = await prisma.experiment.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("Experiment", id);
    const from = existing.status as ExperimentStatus;
    await prisma.experiment.update({
      where: { id },
      data: {
        status,
        startedAt: patch.startedAt ?? existing.startedAt,
        endedAt: patch.endedAt ?? existing.endedAt,
        conclusion: patch.conclusion ?? existing.conclusion,
      },
    });
    await changeEventService.append({
      workspaceId,
      subjectType: "EXPERIMENT",
      subjectId: id,
      actorId,
      kind: "experiment.transitioned",
      summary: `Experiment ${from} → ${status}`,
      payload: { from, to: status },
    });
  }

  async get(workspaceId: string, id: string) {
    const e = await prisma.experiment.findFirst({
      where: { id, workspaceId },
      include: { hypothesis: true, learnings: true },
    });
    if (!e) throw notFound("Experiment", id);
    return e;
  }
}

export const experimentService = new ExperimentService();
