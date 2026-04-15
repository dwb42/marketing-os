import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { changeEventService } from "./change-event.service.js";

export type SyncRunType = "PULL_PERFORMANCE" | "PUSH_CAMPAIGN" | "PUSH_ASSET_VERSION";
export type ChannelId = "GOOGLE_ADS" | "META_ADS";

export class SyncRunService {
  async createOrGet(input: {
    workspaceId: string;
    channel: ChannelId;
    type: SyncRunType;
    targetType: string;
    targetId: string;
    idempotencyKey: string;
    input: Record<string, unknown>;
  }): Promise<{ id: string; reused: boolean }> {
    const existing = await prisma.syncRun.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { id: existing.id, reused: true };

    const id = newId("syncRun");
    await prisma.syncRun.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        channel: input.channel,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        input: input.input as object,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "SYNC_RUN",
      subjectId: id,
      kind: "sync_run.created",
      summary: `${input.type} queued for ${input.channel}`,
      payload: { targetType: input.targetType, targetId: input.targetId },
    });
    return { id, reused: false };
  }

  async markRunning(id: string) {
    await prisma.syncRun.update({
      where: { id },
      data: { status: "RUNNING", startedAt: new Date(), attempt: { increment: 1 } },
    });
  }

  async markSucceeded(id: string, output: Record<string, unknown>) {
    await prisma.syncRun.update({
      where: { id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        output: output as object,
      },
    });
  }

  async markFailed(
    id: string,
    errorKind: string,
    errorMessage: string,
    status: "FAILED" | "PARTIAL" = "FAILED",
  ) {
    await prisma.syncRun.update({
      where: { id },
      data: { status, finishedAt: new Date(), errorKind, errorMessage },
    });
  }
}

export const syncRunService = new SyncRunService();
