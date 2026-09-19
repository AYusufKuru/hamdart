-- AlterTable
ALTER TABLE "BudgetCashEntry" ADD COLUMN "fileId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BudgetCashEntry" ADD COLUMN "fileName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BudgetCashEntry" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT '';
CREATE INDEX "BudgetCashEntry_fileId_idx" ON "BudgetCashEntry"("fileId");
