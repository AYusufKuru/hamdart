-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderDate" TEXT NOT NULL,
    "deliveryDate" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recipeNo" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "productCode" TEXT,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lines" TEXT NOT NULL,
    "extras" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterialOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceNote" TEXT,
    "targetWarehouseId" TEXT NOT NULL,
    "orderDate" TEXT NOT NULL,
    "expectedDelivery" TEXT,
    "receivedDate" TEXT,
    "qcStartedAt" TEXT,
    "qcCompletedAt" TEXT,
    "warehousedAt" TEXT,
    "returnedAt" TEXT,
    "lotNo" TEXT,
    "invoiceNo" TEXT,
    "qcNotes" TEXT,
    "qcAnalyst" TEXT,

    CONSTRAINT "RawMaterialOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "used" DOUBLE PRECISION NOT NULL,
    "temperature" TEXT NOT NULL,
    "humidity" TEXT NOT NULL,
    "manager" TEXT NOT NULL,
    "items" INTEGER NOT NULL,
    "lastAudit" TEXT NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStockItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "minStock" DOUBLE PRECISION NOT NULL,
    "maxStock" DOUBLE PRECISION,
    "lotNo" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "temperature" TEXT,
    "replenishFromWarehouseId" TEXT,
    "labTargetQuantity" DOUBLE PRECISION,
    "labDirectEntry" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WarehouseStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "efficiency" DOUBLE PRECISION NOT NULL,
    "currentBatch" TEXT NOT NULL,
    "outputToday" DOUBLE PRECISION NOT NULL,
    "targetToday" DOUBLE PRECISION NOT NULL,
    "operator" TEXT NOT NULL,
    "lastMaintenance" TEXT NOT NULL,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "yield" DOUBLE PRECISION NOT NULL,
    "qcScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabExperiment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "researcher" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "samples" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,

    CONSTRAINT "LabExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSample" (
    "id" TEXT NOT NULL,
    "sampleNo" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receivedDate" TEXT NOT NULL,
    "analyst" TEXT NOT NULL,
    "result" TEXT,

    CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxNo" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hireDate" TEXT NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "iban" TEXT NOT NULL,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minStock" DOUBLE PRECISION NOT NULL,
    "maxStock" DOUBLE PRECISION NOT NULL,
    "lotNo" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,

    CONSTRAINT "FinishedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityLabel" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRow" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "annual" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BudgetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_sku_key" ON "RawMaterial"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_batchNo_key" ON "ProductionBatch"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "LabExperiment_code_key" ON "LabExperiment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LabSample_sampleNo_key" ON "LabSample"("sampleNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
