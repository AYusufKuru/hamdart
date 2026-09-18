CREATE TABLE IF NOT EXISTS "ChequeNote" (
    "id" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "bankName" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT NOT NULL DEFAULT '',
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'Portföy',
    "notes" TEXT NOT NULL DEFAULT '',
    "relatedInvoiceNo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ChequeNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChequeNote_docNo_key" ON "ChequeNote"("docNo");

CREATE TABLE IF NOT EXISTS "ChequeNoteInstallment" (
    "id" TEXT NOT NULL,
    "chequeNoteId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "serialNo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Bekliyor',
    "paidAt" TEXT NOT NULL DEFAULT '',
    "invoiceNo" TEXT NOT NULL DEFAULT '',
    "paymentEventId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ChequeNoteInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChequeNoteInstallment_chequeNoteId_idx" ON "ChequeNoteInstallment"("chequeNoteId");
CREATE INDEX IF NOT EXISTS "ChequeNoteInstallment_status_idx" ON "ChequeNoteInstallment"("status");
CREATE INDEX IF NOT EXISTS "ChequeNoteInstallment_dueDate_idx" ON "ChequeNoteInstallment"("dueDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChequeNoteInstallment_chequeNoteId_fkey'
  ) THEN
    ALTER TABLE "ChequeNoteInstallment"
      ADD CONSTRAINT "ChequeNoteInstallment_chequeNoteId_fkey"
      FOREIGN KEY ("chequeNoteId") REFERENCES "ChequeNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
