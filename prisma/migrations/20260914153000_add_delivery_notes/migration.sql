-- CreateTable
CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "noteNo" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "shipDate" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "relatedOrderNo" TEXT NOT NULL DEFAULT '',
    "relatedInvoiceNo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNoteLine" (
    "id" TEXT NOT NULL,
    "noteNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityLabel" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "DeliveryNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_noteNo_key" ON "DeliveryNote"("noteNo");

-- CreateIndex
CREATE INDEX "DeliveryNoteLine_noteNo_idx" ON "DeliveryNoteLine"("noteNo");

-- AddForeignKey
ALTER TABLE "DeliveryNoteLine" ADD CONSTRAINT "DeliveryNoteLine_noteNo_fkey" FOREIGN KEY ("noteNo") REFERENCES "DeliveryNote"("noteNo") ON DELETE CASCADE ON UPDATE CASCADE;
