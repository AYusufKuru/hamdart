-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterForeignKey: fatura silinince satırlar da gitsin
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_invoiceNo_fkey";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceNo_fkey" FOREIGN KEY ("invoiceNo") REFERENCES "Invoice"("invoiceNo") ON DELETE CASCADE ON UPDATE CASCADE;
