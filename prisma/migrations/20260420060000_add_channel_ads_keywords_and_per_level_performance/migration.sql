-- AlterTable
ALTER TABLE "ChannelAdGroup" ADD COLUMN     "cpcBidMicros" BIGINT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "ChannelAd" (
    "id" TEXT NOT NULL,
    "channelAdGroupId" TEXT NOT NULL,
    "externalId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'RESPONSIVE_SEARCH_AD',
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "descriptions" JSONB NOT NULL DEFAULT '[]',
    "finalUrls" JSONB NOT NULL DEFAULT '[]',
    "path1" TEXT,
    "path2" TEXT,
    "policyApprovalStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelKeyword" (
    "id" TEXT NOT NULL,
    "channelAdGroupId" TEXT,
    "channelCampaignId" TEXT,
    "externalId" TEXT,
    "text" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'PHRASE',
    "negative" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "cpcBidMicros" BIGINT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdGroupPerformanceDaily" (
    "id" TEXT NOT NULL,
    "channelAdGroupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncRunId" TEXT,

    CONSTRAINT "AdGroupPerformanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordPerformanceDaily" (
    "id" TEXT NOT NULL,
    "channelKeywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncRunId" TEXT,

    CONSTRAINT "KeywordPerformanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformanceDaily" (
    "id" TEXT NOT NULL,
    "channelAdId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncRunId" TEXT,

    CONSTRAINT "AdPerformanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelAd_channelAdGroupId_idx" ON "ChannelAd"("channelAdGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAd_channelAdGroupId_externalId_key" ON "ChannelAd"("channelAdGroupId", "externalId");

-- CreateIndex
CREATE INDEX "ChannelKeyword_channelAdGroupId_idx" ON "ChannelKeyword"("channelAdGroupId");

-- CreateIndex
CREATE INDEX "ChannelKeyword_channelCampaignId_idx" ON "ChannelKeyword"("channelCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelKeyword_channelAdGroupId_externalId_key" ON "ChannelKeyword"("channelAdGroupId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelKeyword_channelCampaignId_externalId_key" ON "ChannelKeyword"("channelCampaignId", "externalId");

-- CreateIndex
CREATE INDEX "AdGroupPerformanceDaily_date_idx" ON "AdGroupPerformanceDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdGroupPerformanceDaily_channelAdGroupId_date_key" ON "AdGroupPerformanceDaily"("channelAdGroupId", "date");

-- CreateIndex
CREATE INDEX "KeywordPerformanceDaily_date_idx" ON "KeywordPerformanceDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordPerformanceDaily_channelKeywordId_date_key" ON "KeywordPerformanceDaily"("channelKeywordId", "date");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_date_idx" ON "AdPerformanceDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdPerformanceDaily_channelAdId_date_key" ON "AdPerformanceDaily"("channelAdId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAdGroup_channelCampaignId_externalId_key" ON "ChannelAdGroup"("channelCampaignId", "externalId");

-- AddForeignKey
ALTER TABLE "ChannelAd" ADD CONSTRAINT "ChannelAd_channelAdGroupId_fkey" FOREIGN KEY ("channelAdGroupId") REFERENCES "ChannelAdGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelKeyword" ADD CONSTRAINT "ChannelKeyword_channelAdGroupId_fkey" FOREIGN KEY ("channelAdGroupId") REFERENCES "ChannelAdGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelKeyword" ADD CONSTRAINT "ChannelKeyword_channelCampaignId_fkey" FOREIGN KEY ("channelCampaignId") REFERENCES "ChannelCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGroupPerformanceDaily" ADD CONSTRAINT "AdGroupPerformanceDaily_channelAdGroupId_fkey" FOREIGN KEY ("channelAdGroupId") REFERENCES "ChannelAdGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordPerformanceDaily" ADD CONSTRAINT "KeywordPerformanceDaily_channelKeywordId_fkey" FOREIGN KEY ("channelKeywordId") REFERENCES "ChannelKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceDaily" ADD CONSTRAINT "AdPerformanceDaily_channelAdId_fkey" FOREIGN KEY ("channelAdId") REFERENCES "ChannelAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
