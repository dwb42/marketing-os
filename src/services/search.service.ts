import { prisma } from "./prisma.js";

export interface SearchFilter {
  workspaceId: string;
  q?: string;
  initiativeId?: string;
  clusterId?: string;
  status?: string;
  from?: Date;
  to?: Date;
}

export class SearchService {
  async search(filter: SearchFilter) {
    const { workspaceId, q, initiativeId, clusterId, status, from, to } = filter;

    const textFilter = q
      ? { OR: [{ name: { contains: q } }, { objective: { contains: q } }] }
      : {};
    const dateFilter = from && to ? { updatedAt: { gte: from, lte: to } } : {};

    const [campaigns, assets, clusters, findings, learnings] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          workspaceId,
          ...textFilter,
          ...(initiativeId ? { initiativeId } : {}),
          ...(status ? { status: status as any } : {}),
          ...dateFilter,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.asset.findMany({
        where: {
          workspaceId,
          ...(q ? { name: { contains: q } } : {}),
          ...dateFilter,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.intentCluster.findMany({
        where: {
          workspaceId,
          ...(q ? { name: { contains: q } } : {}),
          ...(initiativeId ? { initiativeId } : {}),
          ...(clusterId ? { id: clusterId } : {}),
          ...(status ? { status: status as any } : {}),
          ...dateFilter,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.finding.findMany({
        where: {
          workspaceId,
          ...(q
            ? {
                OR: [
                  { beobachtung: { contains: q } },
                  { interpretation: { contains: q } },
                  { empfehlung: { contains: q } },
                ],
              }
            : {}),
          ...(initiativeId ? { initiativeId } : {}),
          ...(clusterId ? { clusterId } : {}),
          ...(status ? { status: status as any } : {}),
          ...dateFilter,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.learning.findMany({
        where: {
          workspaceId,
          ...(q ? { statement: { contains: q } } : {}),
          ...(initiativeId ? { initiativeId } : {}),
          ...dateFilter,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return { campaigns, assets, clusters, findings, learnings };
  }
}

export const searchService = new SearchService();
