CREATE TABLE IF NOT EXISTS "BudgetCashEntry" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "invoiceNo" TEXT NOT NULL DEFAULT '',
    "documented" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BudgetCashEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BudgetCashEntry_direction_idx" ON "BudgetCashEntry"("direction");
CREATE INDEX IF NOT EXISTS "BudgetCashEntry_date_idx" ON "BudgetCashEntry"("date");
CREATE INDEX IF NOT EXISTS "BudgetCashEntry_dueDate_idx" ON "BudgetCashEntry"("dueDate");
CREATE INDEX IF NOT EXISTS "BudgetCashEntry_invoiceNo_idx" ON "BudgetCashEntry"("invoiceNo");
