-- AlterTable
ALTER TABLE "LabSample" ADD COLUMN "sourceKind" TEXT NOT NULL DEFAULT 'product';
ALTER TABLE "LabSample" ADD COLUMN "disposition" TEXT NOT NULL DEFAULT 'open';
