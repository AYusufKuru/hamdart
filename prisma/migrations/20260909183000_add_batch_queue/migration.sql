-- AlterTable
ALTER TABLE "ProductionBatch" ADD COLUMN "queuePosition" INTEGER;

-- CreateIndex
CREATE INDEX "ProductionBatch_line_status_idx" ON "ProductionBatch"("line", "status");

-- CreateIndex
CREATE INDEX "ProductionBatch_line_queuePosition_idx" ON "ProductionBatch"("line", "queuePosition");
