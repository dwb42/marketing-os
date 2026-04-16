import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";

export interface IngestOutcomeInput {
  productId: string;
  type: string;
  occurredAt: Date;
  sessionRef?: string;
  attribution?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export class OutcomeService {
  async ingest(input: IngestOutcomeInput): Promise<string> {
    const id = newId("outcome");
    await prisma.productOutcomeEvent.create({
      data: {
        id,
        productId: input.productId,
        type: input.type,
        occurredAt: input.occurredAt,
        sessionRef: input.sessionRef ?? null,
        attribution: (input.attribution ?? {}) as object,
        payload: (input.payload ?? {}) as object,
      },
    });
    return id;
  }

  async funnel(productId: string, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<{ type: string; count: bigint }[]>`
      SELECT type, COUNT(*) as count
      FROM "ProductOutcomeEvent"
      WHERE "productId" = ${productId}
        AND "occurredAt" >= ${from}
        AND "occurredAt" <= ${to}
      GROUP BY type
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  }

  async query(params: { productId: string; type?: string; from: Date; to: Date }) {
    return prisma.productOutcomeEvent.findMany({
      where: {
        productId: params.productId,
        ...(params.type ? { type: params.type } : {}),
        occurredAt: { gte: params.from, lte: params.to },
      },
      orderBy: { occurredAt: "asc" },
    });
  }
}

export const outcomeService = new OutcomeService();
