-- AlterTable
ALTER TABLE "BudgetCashEntry" ADD COLUMN "cashAccountId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "BudgetCashEntry_cashAccountId_idx" ON "BudgetCashEntry"("cashAccountId");
