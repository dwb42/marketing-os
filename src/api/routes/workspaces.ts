import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { workspaceService } from "../../services/workspace.service.js";
import { ProductIdSchema, WorkspaceIdSchema } from "../schemas.js";

const CreateWorkspaceSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  timezone: z.string().optional(),
});

const CreateBrandSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
});

const CreateProductSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  brandId: z.string().startsWith("brd_"),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const CreateAudienceSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  productId: ProductIdSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  facets: z.record(z.unknown()).optional(),
});

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workspaces", async () => workspaceService.listWorkspaces());

  app.post("/workspaces", async (req) => {
    const body = CreateWorkspaceSchema.parse(req.body);
    return workspaceService.createWorkspace(body);
  });

  app.post("/brands", async (req) => {
    const body = CreateBrandSchema.parse(req.body);
    return workspaceService.createBrand(body);
  });

  app.post("/products", async (req) => {
    const body = CreateProductSchema.parse(req.body);
    return workspaceService.createProduct(body);
  });

  app.get("/products", async (req) => {
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return workspaceService.listProducts(q.workspaceId);
  });

  app.post("/audience-segments", async (req) => {
    const body = CreateAudienceSchema.parse(req.body);
    return workspaceService.createAudienceSegment(body);
  });

  app.get("/brands", async (req) => {
    const q = z.object({ workspaceId: WorkspaceIdSchema }).parse(req.query);
    return workspaceService.listBrands(q.workspaceId);
  });

  app.get("/audience-segments", async (req) => {
    const q = z
      .object({
        workspaceId: WorkspaceIdSchema,
        productId: ProductIdSchema.optional(),
      })
      .parse(req.query);
    return workspaceService.listAudienceSegments(
      q.workspaceId,
      q.productId,
    );
  });
}
