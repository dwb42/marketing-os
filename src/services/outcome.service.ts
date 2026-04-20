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

  // Attribution-Breakdown: gruppiert Outcomes nach utm_content (≙
  // externalAdGroupId) und utm_term (≙ Keyword-Text), gefiltert auf
  // Outcomes mit utm_campaign = einem der gegebenen Werte.
  //
  // Wird vom Campaign-Detail gebraucht, um OS-attribuierte Conversions
  // pro Ad-Group und pro Keyword anzuzeigen.
  async breakdownByAdGroupAndKeyword(params: {
    productId: string;
    utmCampaignValues: string[];
    from: Date;
    to: Date;
  }): Promise<{
    totalMatched: number;
    byAdGroupExternalId: Record<string, { total: number; byType: Record<string, number> }>;
    byKeywordText: Record<string, { total: number; byType: Record<string, number> }>;
    unattributedToAdGroup: number;
  }> {
    if (params.utmCampaignValues.length === 0) {
      return {
        totalMatched: 0,
        byAdGroupExternalId: {},
        byKeywordText: {},
        unattributedToAdGroup: 0,
      };
    }

    const rows = await prisma.$queryRaw<
      Array<{
        type: string;
        utm_content: string | null;
        utm_term: string | null;
        count: bigint;
      }>
    >`
      SELECT
        type,
        attribution->>'utm_content' AS utm_content,
        attribution->>'utm_term'    AS utm_term,
        COUNT(*)                    AS count
      FROM "ProductOutcomeEvent"
      WHERE "productId"   = ${params.productId}
        AND "occurredAt" >= ${params.from}
        AND "occurredAt" <= ${params.to}
        AND attribution->>'utm_campaign' = ANY(${params.utmCampaignValues}::text[])
      GROUP BY type, utm_content, utm_term
    `;

    const byAdGroup: Record<
      string,
      { total: number; byType: Record<string, number> }
    > = {};
    const byKeyword: Record<
      string,
      { total: number; byType: Record<string, number> }
    > = {};
    let total = 0;
    let unattributed = 0;

    for (const r of rows) {
      const n = Number(r.count);
      total += n;
      if (r.utm_content) {
        const bucket = (byAdGroup[r.utm_content] ??= { total: 0, byType: {} });
        bucket.total += n;
        bucket.byType[r.type] = (bucket.byType[r.type] ?? 0) + n;
      } else {
        unattributed += n;
      }
      if (r.utm_term) {
        const bucket = (byKeyword[r.utm_term] ??= { total: 0, byType: {} });
        bucket.total += n;
        bucket.byType[r.type] = (bucket.byType[r.type] ?? 0) + n;
      }
    }

    return {
      totalMatched: total,
      byAdGroupExternalId: byAdGroup,
      byKeywordText: byKeyword,
      unattributedToAdGroup: unattributed,
    };
  }
}

export const outcomeService = new OutcomeService();
