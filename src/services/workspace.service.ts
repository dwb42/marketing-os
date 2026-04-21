import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";
import { notFound } from "../lib/errors.js";

export class WorkspaceService {
  async createWorkspace(input: { slug: string; name: string; timezone?: string }) {
    const id = newId("workspace");
    return prisma.workspace.create({
      data: {
        id,
        slug: input.slug,
        name: input.name,
        timezone: input.timezone ?? "Europe/Berlin",
      },
    });
  }

  async listWorkspaces() {
    return prisma.workspace.findMany({ orderBy: { createdAt: "asc" } });
  }

  async createBrand(input: { workspaceId: string; slug: string; name: string }) {
    const id = newId("brand");
    return prisma.brand.create({
      data: { id, workspaceId: input.workspaceId, slug: input.slug, name: input.name },
    });
  }

  async createProduct(input: {
    workspaceId: string;
    brandId: string;
    slug: string;
    name: string;
    description?: string;
  }) {
    const id = newId("product");
    return prisma.product.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
      },
    });
  }

  async listProducts(workspaceId: string) {
    return prisma.product.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  }

  async createAudienceSegment(input: {
    workspaceId: string;
    productId: string;
    name: string;
    description?: string;
    facets?: Record<string, unknown>;
  }) {
    const id = newId("audienceSegment");
    return prisma.audienceSegment.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        productId: input.productId,
        name: input.name,
        description: input.description ?? null,
        facets: (input.facets ?? {}) as object,
      },
    });
  }

  async listBrands(workspaceId: string) {
    return prisma.brand.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  }

  async listAudienceSegments(workspaceId: string, productId?: string) {
    return prisma.audienceSegment.findMany({
      where: { workspaceId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: "asc" },
    });
  }

  async getWorkspaceBySlug(slug: string) {
    const w = await prisma.workspace.findUnique({ where: { slug } });
    if (!w) throw notFound("Workspace", slug);
    return w;
  }
}

export const workspaceService = new WorkspaceService();
