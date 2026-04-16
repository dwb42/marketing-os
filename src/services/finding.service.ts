import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { notFound } from "../lib/errors.js";
import { changeEventService } from "./change-event.service.js";

type FindingStatus = "OPEN" | "ADDRESSED" | "WONT_FIX" | "ARCHIVED";
type FindingConfidence = "LOW" | "MEDIUM" | "HIGH";

export class FindingService {
  async create(input: {
    workspaceId: string;
    beobachtung: string;
    interpretation: string;
    empfehlung: string;
    initiativeId?: string;
    clusterId?: string;
    modulBetroffen?: string;
    outcomeBetroffen?: string;
    konfidenz?: FindingConfidence;
    konfidenzGrund?: string;
    empfehlungAn?: string;
    datenLuecke?: string;
    actorId?: string;
  }): Promise<string> {
    const id = newId("finding");
    await prisma.finding.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        initiativeId: input.initiativeId ?? null,
        clusterId: input.clusterId ?? null,
        modulBetroffen: input.modulBetroffen ?? null,
        outcomeBetroffen: input.outcomeBetroffen ?? null,
        beobachtung: input.beobachtung,
        interpretation: input.interpretation,
        konfidenz: input.konfidenz ?? "LOW",
        konfidenzGrund: input.konfidenzGrund ?? null,
        empfehlung: input.empfehlung,
        empfehlungAn: input.empfehlungAn ?? null,
        datenLuecke: input.datenLuecke ?? null,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "FINDING",
      subjectId: id,
      actorId: input.actorId,
      kind: "finding.created",
      summary: input.beobachtung.slice(0, 120),
      payload: { konfidenz: input.konfidenz ?? "LOW" },
    });
    return id;
  }

  async list(
    workspaceId: string,
    filter: { initiativeId?: string; clusterId?: string; status?: FindingStatus } = {},
  ) {
    return prisma.finding.findMany({
      where: {
        workspaceId,
        ...(filter.initiativeId ? { initiativeId: filter.initiativeId } : {}),
        ...(filter.clusterId ? { clusterId: filter.clusterId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(workspaceId: string, id: string) {
    const f = await prisma.finding.findFirst({ where: { id, workspaceId } });
    if (!f) throw notFound("Finding", id);
    return f;
  }

  async setStatus(workspaceId: string, id: string, status: FindingStatus, actorId?: string) {
    const existing = await prisma.finding.findFirst({ where: { id, workspaceId } });
    if (!existing) throw notFound("Finding", id);
    const from = existing.status;
    await prisma.finding.update({ where: { id }, data: { status } });
    await changeEventService.append({
      workspaceId,
      subjectType: "FINDING",
      subjectId: id,
      actorId,
      kind: "finding.status_changed",
      summary: `Finding ${from} → ${status}`,
      payload: { from, to: status },
    });
  }
}

export const findingService = new FindingService();
