import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { invalidInput, invalidState, notFound } from "../lib/errors.js";
import { canTransitionAssetVersion } from "../domain/policies.js";
import type { AssetVersionStatus } from "../domain/status.js";
import { changeEventService } from "./change-event.service.js";

type AssetKind = "HEADLINE_SET" | "DESCRIPTION_SET" | "IMAGE" | "VIDEO" | "LANDING_PAGE" | "TEXT_BLOCK";

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
