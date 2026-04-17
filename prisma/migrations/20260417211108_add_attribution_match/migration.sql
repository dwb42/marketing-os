-- AlterTable
ALTER TABLE "ProductOutcomeEvent" ADD COLUMN     "matchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AttributionMatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "senderHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sessionRef" TEXT,
    "confidence" TEXT NOT NULL,
    "matchedOutcomeEventId" TEXT,
    "candidateCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttributionMatch_matchedOutcomeEventId_key" ON "AttributionMatch"("matchedOutcomeEventId");

-- CreateIndex
CREATE INDEX "AttributionMatch_productId_occurredAt_idx" ON "AttributionMatch"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionMatch_senderHash_occurredAt_idx" ON "AttributionMatch"("senderHash", "occurredAt");

-- AddForeignKey
ALTER TABLE "AttributionMatch" ADD CONSTRAINT "AttributionMatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionMatch" ADD CONSTRAINT "AttributionMatch_matchedOutcomeEventId_fkey" FOREIGN KEY ("matchedOutcomeEventId") REFERENCES "ProductOutcomeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial index: hot path for the matcher is "unmatched cta_click rows in
-- a time window for a product". A partial index on type+matchedAt IS NULL
-- keeps the index tiny (only the still-open candidates).
CREATE INDEX "idx_outcome_unmatched_cta"
  ON "ProductOutcomeEvent" ("productId", "occurredAt")
  WHERE "matchedAt" IS NULL AND type = 'cta_click';

-- Analysis view: daily attribution rate per product, broken down by
-- confidence bucket. Consumed by reporting, not by the API.
CREATE OR REPLACE VIEW "attribution_rate" AS
SELECT
  "productId"                                    AS product_id,
  date_trunc('day', "occurredAt")                AS day,
  confidence,
  COUNT(*)                                       AS n
FROM "AttributionMatch"
GROUP BY 1, 2, 3;
