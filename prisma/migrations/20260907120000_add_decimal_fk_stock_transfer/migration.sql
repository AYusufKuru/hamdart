-- AlterTable
ALTER TABLE "BudgetRow" ALTER COLUMN "annual" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "spent" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "InvoiceLine" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "LedgerEntry" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Personnel" ALTER COLUMN "salary" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "RawMaterial" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "RawMaterialOrder" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(18,4);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceNo_idx" ON "InvoiceLine"("invoiceNo");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderDate_idx" ON "Order"("orderDate");

-- CreateIndex
CREATE INDEX "RawMaterialOrder_status_idx" ON "RawMaterialOrder"("status");

-- CreateIndex
CREATE INDEX "RawMaterialOrder_sku_idx" ON "RawMaterialOrder"("sku");

-- CreateIndex
CREATE INDEX "RawMaterialOrder_targetWarehouseId_idx" ON "RawMaterialOrder"("targetWarehouseId");

-- CreateIndex
CREATE INDEX "WarehouseStockItem_warehouseId_idx" ON "WarehouseStockItem"("warehouseId");

-- CreateIndex
CREATE INDEX "WarehouseStockItem_status_idx" ON "WarehouseStockItem"("status");

-- CreateIndex
CREATE INDEX "WarehouseStockItem_sku_warehouseId_idx" ON "WarehouseStockItem"("sku", "warehouseId");

-- AddForeignKey
ALTER TABLE "RawMaterialOrder" ADD CONSTRAINT "RawMaterialOrder_targetWarehouseId_fkey" FOREIGN KEY ("targetWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockItem" ADD CONSTRAINT "WarehouseStockItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockItem" ADD CONSTRAINT "WarehouseStockItem_replenishFromWarehouseId_fkey" FOREIGN KEY ("replenishFromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceNo_fkey" FOREIGN KEY ("invoiceNo") REFERENCES "Invoice"("invoiceNo") ON DELETE RESTRICT ON UPDATE CASCADE;
