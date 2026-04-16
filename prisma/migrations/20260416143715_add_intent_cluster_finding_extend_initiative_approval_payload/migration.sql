-- CreateEnum
CREATE TYPE "ClusterStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClusterValidation" AS ENUM ('HYPOTHESIS', 'WEAK_EVIDENCE', 'EVIDENCED', 'REFUTED');

-- CreateEnum
CREATE TYPE "FindingConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ADDRESSED', 'WONT_FIX', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN     "assumptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "hypothesis" TEXT,
ADD COLUMN     "learnQuestions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "outcomeLadder" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "risks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "successCriteria" TEXT;

-- CreateTable
CREATE TABLE "IntentCluster" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "name" TEXT NOT NULL,
    "status" "ClusterStatus" NOT NULL DEFAULT 'DRAFT',
    "validation" "ClusterValidation" NOT NULL DEFAULT 'HYPOTHESIS',
    "modulPrimary" TEXT NOT NULL,
    "modulSecondary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outcome" TEXT,
    "lebenslage" TEXT,
    "suchbegriffe" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "naechsteAktion" TEXT,
    "friktionspunkte" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "clusterId" TEXT,
    "modulBetroffen" TEXT,
    "outcomeBetroffen" TEXT,
    "beobachtung" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "konfidenz" "FindingConfidence" NOT NULL DEFAULT 'LOW',
    "konfidenzGrund" TEXT,
    "empfehlung" TEXT NOT NULL,
    "empfehlungAn" TEXT,
    "datenLuecke" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentCluster_workspaceId_status_idx" ON "IntentCluster"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "IntentCluster_productId_idx" ON "IntentCluster"("productId");

-- CreateIndex
CREATE INDEX "IntentCluster_initiativeId_idx" ON "IntentCluster"("initiativeId");

-- CreateIndex
CREATE INDEX "Finding_workspaceId_status_idx" ON "Finding"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Finding_initiativeId_idx" ON "Finding"("initiativeId");

-- CreateIndex
CREATE INDEX "Finding_clusterId_idx" ON "Finding"("clusterId");

-- AddForeignKey
ALTER TABLE "IntentCluster" ADD CONSTRAINT "IntentCluster_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentCluster" ADD CONSTRAINT "IntentCluster_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentCluster" ADD CONSTRAINT "IntentCluster_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "IntentCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
