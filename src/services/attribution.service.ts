import { prisma } from "./prisma.js";
import { newId } from "../lib/ids.js";

type Confidence = "confirmed" | "ambiguous" | "unattributed";

export interface MatchInput {
  productId: string;
  messageHash: string;
  senderHash: string;
  occurredAt: Date;
}

export interface MatchResult {
  sessionRef: string | null;
  confidence: Confidence;
}

/**
 * Time-window attribution matcher. Given a chat-message arriving at
 * `occurredAt`, find an unmatched `cta_click` outcome event for the same
 * product in the window [occurredAt − 15min, occurredAt + 30s] and claim
 * its `sessionRef` (pm_cid) atomically.
 *
 *   0 candidates → confidence=unattributed, sessionRef=null
 *   1 candidate  → confidence=confirmed
 *   N candidates → confidence=ambiguous, nearest-by-absolute-time wins
 *
 * The claim uses a CAS update (WHERE matchedAt IS NULL) so two messages
 * landing on the same candidate don't both win — the loser falls through
 * to `unattributed`.
 *
 * Every call — match or miss — is logged to AttributionMatch so we can
 * measure attribution rate over time via the attribution_rate view.
 */
export class AttributionService {
  private readonly matchWindowMs = 15 * 60 * 1000;
  private readonly clockSkewMs = 30 * 1000;

  async match(input: MatchInput): Promise<MatchResult> {
    const messageTime = input.occurredAt.getTime();
    const lo = new Date(messageTime - this.matchWindowMs);
    const hi = new Date(messageTime + this.clockSkewMs);

    const candidates = await prisma.productOutcomeEvent.findMany({
      where: {
        productId: input.productId,
        type: "cta_click",
        occurredAt: { gte: lo, lte: hi },
        matchedAt: null,
      },
      orderBy: { occurredAt: "desc" },
    });

    // Pick nearest by absolute time distance. Sort is O(n) small and
    // keeps intent obvious — the DB ordering above is just a tie-break
    // hint (prefer the later event when distances tie).
    const nearest = candidates.slice().sort(
      (a, b) =>
        Math.abs(a.occurredAt.getTime() - messageTime) -
        Math.abs(b.occurredAt.getTime() - messageTime),
    )[0];

    let sessionRef: string | null = null;
    let confidence: Confidence = "unattributed";
    let matchedOutcomeEventId: string | null = null;

    if (candidates.length === 1 && nearest) {
      sessionRef = nearest.sessionRef;
      confidence = "confirmed";
      matchedOutcomeEventId = nearest.id;
    } else if (candidates.length > 1 && nearest) {
      sessionRef = nearest.sessionRef;
      confidence = "ambiguous";
      matchedOutcomeEventId = nearest.id;
    }

    const id = newId("attributionMatch");

    await prisma.$transaction(async (tx) => {
      if (matchedOutcomeEventId) {
        const claimed = await tx.productOutcomeEvent.updateMany({
          where: { id: matchedOutcomeEventId, matchedAt: null },
          data: { matchedAt: new Date() },
        });
        // CAS miss: a concurrent call already claimed this candidate.
        // Degrade this match to unattributed rather than lying.
        if (claimed.count === 0) {
          matchedOutcomeEventId = null;
          sessionRef = null;
          confidence = "unattributed";
        }
      }

      await tx.attributionMatch.create({
        data: {
          id,
          productId: input.productId,
          messageHash: input.messageHash,
          senderHash: input.senderHash,
          occurredAt: input.occurredAt,
          sessionRef,
          confidence,
          matchedOutcomeEventId,
          candidateCount: candidates.length,
        },
      });
    });

    return { sessionRef, confidence };
  }
}

export const attributionService = new AttributionService();
