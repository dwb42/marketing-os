import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
import { canTransitionAssetVersion } from "../domain/policies.js";
import type { AssetVersionStatus } from "../domain/status.js";
import { changeEventService } from "./change-event.service.js";

type AssetKind = "HEADLINE_SET" | "DESCRIPTION_SET" | "IMAGE" | "VIDEO" | "LANDING_PAGE" | "TEXT_BLOCK";

// AssetVersion statuses in which destructive edits are still allowed.
// APPROVED and PUBLISHED are historical records and must never be altered.
const VERSION_MUTABLE: AssetVersionStatus[] = ["DRAFT"];
const VERSION_HARD_DELETABLE: AssetVersionStatus[] = ["DRAFT", "SUPERSEDED"];

export class AssetService {
  async createAsset(input: {
    workspaceId: string;
    kind: AssetKind;
    name: string;
    description?: string;
    actorId?: string;
  }): Promise<string> {
    const id = newId("asset");
    await prisma.asset.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
      },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "ASSET",
      subjectId: id,
      actorId: input.actorId,
      kind: "asset.created",
      summary: `Asset "${input.name}" created`,
      payload: { kind: input.kind },
    });
    return id;
  }

  async addVersion(input: {
    workspaceId: string;
    assetId: string;
    content: unknown;
    actorId?: string;
  }): Promise<string> {
    const asset = await prisma.asset.findFirst({
      where: { id: input.assetId, workspaceId: input.workspaceId },
      include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } },
    });
    if (!asset) throw notFound("Asset", input.assetId);

    const lastNum = asset.versions[0]?.versionNum ?? 0;
    const nextNum = lastNum + 1;
    const contentJson = JSON.stringify(input.content);
    const hash = createHash("sha256").update(contentJson).digest("hex");

    const id = newId("assetVersion");
    await prisma.assetVersion.create({
      data: {
        id,
        assetId: input.assetId,
        versionNum: nextNum,
        status: "DRAFT",
        content: input.content as object,
        contentHash: hash,
        authorActorId: input.actorId ?? null,
      },
    });

    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "ASSET_VERSION",
      subjectId: id,
      actorId: input.actorId,
      kind: "asset.version_created",
      summary: `Version v${nextNum} created`,
      payload: { assetId: input.assetId, versionNum: nextNum, contentHash: hash },
    });

    return id;
  }

  async transitionVersion(input: {
    workspaceId: string;
    assetVersionId: string;
    to: AssetVersionStatus;
    actorId?: string;
  }): Promise<void> {
    const v = await prisma.assetVersion.findUnique({
      where: { id: input.assetVersionId },
      include: { asset: true },
    });
    if (!v || v.asset.workspaceId !== input.workspaceId) {
      throw notFound("AssetVersion", input.assetVersionId);
    }
    const from = v.status as AssetVersionStatus;
    if (!canTransitionAssetVersion(from, input.to)) {
      throw invalidState(`Illegal asset version transition ${from} → ${input.to}`, {
        assetVersionId: input.assetVersionId,
      });
    }

    if (from === "DRAFT" && input.to === "IN_REVIEW") {
      const content = v.content as Record<string, unknown> | null;
      if (!content || Object.keys(content).length === 0) {
        throw invalidInput("AssetVersion kann nicht in IN_REVIEW übergehen: content ist leer");
      }
    }
    await prisma.assetVersion.update({
      where: { id: input.assetVersionId },
      data: { status: input.to },
    });
    await changeEventService.append({
      workspaceId: input.workspaceId,
      subjectType: "ASSET_VERSION",
      subjectId: input.assetVersionId,
      actorId: input.actorId,
      kind: "asset.version_transitioned",
      summary: `AssetVersion ${from} → ${input.to}`,
      payload: { from, to: input.to },
    });
  }

  async listVersions(workspaceId: string, assetId: string) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId },
      include: { versions: { orderBy: { versionNum: "asc" } } },
    });
    if (!asset) throw notFound("Asset", assetId);
    return asset.versions;
  }

  async list(
    workspaceId: string,
    filter: { kind?: AssetKind; search?: string; hasNoVersion?: boolean } = {},
  ) {
    return prisma.asset.findMany({
      where: {
        workspaceId,
        ...(filter.kind ? { kind: filter.kind } : {}),
        ...(filter.search
          ? {
              OR: [
                { name: { contains: filter.search, mode: "insensitive" } },
                { description: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filter.hasNoVersion ? { versions: { none: {} } } : {}),
      },
      include: {
        versions: { orderBy: { versionNum: "desc" }, take: 1, select: { id: true, versionNum: true, status: true, contentHash: true, updatedAt: true } },
        _count: { select: { versions: true, campaignAssets: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(workspaceId: string, assetId: string) {
    const a = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId },
      include: { versions: { orderBy: { versionNum: "asc" } } },
    });
    if (!a) throw notFound("Asset", assetId);
    return a;
  }

  async update(params: {
    workspaceId: string;
    assetId: string;
    patch: { name?: string; description?: string | null };
    actorId?: string;
    reason?: string;
  }) {
    const existing = await prisma.asset.findFirst({
      where: { id: params.assetId, workspaceId: params.workspaceId },
    });
    if (!existing) throw notFound("Asset", params.assetId);
    const data: Record<string, unknown> = {};
    if (params.patch.name !== undefined) data.name = params.patch.name;
    if (params.patch.description !== undefined) data.description = params.patch.description;
    if (Object.keys(data).length === 0) {
      throw invalidInput("PATCH body must contain at least one field");
    }
    const before = { name: existing.name, description: existing.description };
    const updated = await prisma.asset.update({ where: { id: params.assetId }, data });
    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "ASSET",
      subjectId: params.assetId,
      actorId: params.actorId,
      kind: "asset.patched",
      summary: `Asset patched (${Object.keys(data).join(", ")})`,
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
    assetId: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const existing = await prisma.asset.findFirst({
      where: { id: params.assetId, workspaceId: params.workspaceId },
      include: {
        campaignAssets: { include: { campaign: { select: { id: true, status: true, name: true } } } },
      },
    });
    if (!existing) throw notFound("Asset", params.assetId);
    const blockers = existing.campaignAssets.filter((ca) => ca.campaign.status !== "ARCHIVED");
    if (blockers.length > 0) {
      throw invalidState(
        `Asset is still linked to ${blockers.length} non-ARCHIVED campaign(s); unlink or archive them first`,
        {
          assetId: params.assetId,
          blockingCampaigns: blockers.map((b) => ({
            id: b.campaignId,
            status: b.campaign.status,
            name: b.campaign.name,
            role: b.role,
          })),
        },
      );
    }

    const correctsId = newId("changeEvent");
    await prisma.$transaction([
      prisma.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "ASSET",
          subjectId: params.assetId,
          actorId: params.actorId ?? null,
          kind: "asset.deleted",
          summary: `Asset "${existing.name}" hard-deleted`,
          correctsId: params.assetId,
          payload: {
            name: existing.name,
            kind: existing.kind,
            reason: params.reason ?? null,
          },
        },
      }),
      // Asset cascade removes AssetVersions + CampaignAsset links.
      prisma.asset.delete({ where: { id: params.assetId } }),
    ]);

    return { deleted: true, correctsId };
  }

  async patchVersionContent(params: {
    workspaceId: string;
    assetVersionId: string;
    content: unknown;
    actorId?: string;
    reason?: string;
  }) {
    const v = await prisma.assetVersion.findUnique({
      where: { id: params.assetVersionId },
      include: { asset: true },
    });
    if (!v || v.asset.workspaceId !== params.workspaceId) {
      throw notFound("AssetVersion", params.assetVersionId);
    }
    if (!VERSION_MUTABLE.includes(v.status as AssetVersionStatus)) {
      throw invalidState(
        `AssetVersion ${params.assetVersionId} status is ${v.status}; PATCH only allowed in DRAFT`,
      );
    }
    const contentJson = JSON.stringify(params.content);
    const hash = createHash("sha256").update(contentJson).digest("hex");
    const updated = await prisma.assetVersion.update({
      where: { id: params.assetVersionId },
      data: { content: params.content as object, contentHash: hash },
    });
    await changeEventService.append({
      workspaceId: params.workspaceId,
      subjectType: "ASSET_VERSION",
      subjectId: params.assetVersionId,
      actorId: params.actorId,
      kind: "asset_version.patched",
      summary: `AssetVersion v${v.versionNum} content patched`,
      payload: {
        before: { contentHash: v.contentHash },
        after: { contentHash: hash },
        reason: params.reason ?? null,
      },
    });
    return updated;
  }

  async deleteVersion(params: {
    workspaceId: string;
    assetVersionId: string;
    actorId?: string;
    reason?: string;
  }): Promise<{ deleted: true; correctsId: string }> {
    const v = await prisma.assetVersion.findUnique({
      where: { id: params.assetVersionId },
      include: { asset: true },
    });
    if (!v || v.asset.workspaceId !== params.workspaceId) {
      throw notFound("AssetVersion", params.assetVersionId);
    }
    if (!VERSION_HARD_DELETABLE.includes(v.status as AssetVersionStatus)) {
      throw invalidState(
        `Cannot hard-delete AssetVersion in status ${v.status}; only DRAFT or SUPERSEDED allowed`,
      );
    }
    const correctsId = newId("changeEvent");
    await prisma.$transaction([
      prisma.changeEvent.create({
        data: {
          id: correctsId,
          workspaceId: params.workspaceId,
          subjectType: "ASSET_VERSION",
          subjectId: params.assetVersionId,
          actorId: params.actorId ?? null,
          kind: "asset_version.deleted",
          summary: `AssetVersion v${v.versionNum} (${v.status}) hard-deleted`,
          correctsId: params.assetVersionId,
          payload: {
            assetId: v.assetId,
            versionNum: v.versionNum,
            status: v.status,
            contentHash: v.contentHash,
            reason: params.reason ?? null,
          },
        },
      }),
      prisma.assetVersion.delete({ where: { id: params.assetVersionId } }),
    ]);
    return { deleted: true, correctsId };
  }

  async diffVersions(workspaceId: string, assetId: string, aId: string, bId: string) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, workspaceId },
      include: { versions: true },
    });
    if (!asset) throw notFound("Asset", assetId);
    const a = asset.versions.find((v) => v.id === aId);
    const b = asset.versions.find((v) => v.id === bId);
    if (!a || !b) throw notFound("AssetVersion", `${aId}|${bId}`);

    // Strukturiertes Diff: unabhängig vom konkreten Content-Shape,
    // Vergleich per JSON-Key auf Top-Ebene. Vollständige Diffing-Logik
    // kann später via fast-json-patch hinzukommen.
    const aContent = a.content as Record<string, unknown>;
    const bContent = b.content as Record<string, unknown>;
    const keys = new Set([...Object.keys(aContent ?? {}), ...Object.keys(bContent ?? {})]);
    const diff: Record<string, { a: unknown; b: unknown; changed: boolean }> = {};
    for (const key of keys) {
      const av = aContent?.[key];
      const bv = bContent?.[key];
      diff[key] = { a: av, b: bv, changed: JSON.stringify(av) !== JSON.stringify(bv) };
    }
    return {
      a: { id: a.id, versionNum: a.versionNum, status: a.status, contentHash: a.contentHash },
      b: { id: b.id, versionNum: b.versionNum, status: b.status, contentHash: b.contentHash },
      diff,
      identical: a.contentHash === b.contentHash,
    };
  }
}

export const assetService = new AssetService();
