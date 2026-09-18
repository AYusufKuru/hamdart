-- AlterTable
ALTER TABLE "Order" ADD COLUMN "batchNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_batchNo_key" ON "Order"("batchNo");
