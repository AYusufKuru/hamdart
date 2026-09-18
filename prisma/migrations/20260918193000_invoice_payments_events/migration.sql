ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "InvoiceEvent" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL DEFAULT '',
    "fileId" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceEvent_invoiceNo_idx" ON "InvoiceEvent"("invoiceNo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceEvent_invoiceNo_fkey'
  ) THEN
    ALTER TABLE "InvoiceEvent"
      ADD CONSTRAINT "InvoiceEvent_invoiceNo_fkey"
      FOREIGN KEY ("invoiceNo") REFERENCES "Invoice"("invoiceNo") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
