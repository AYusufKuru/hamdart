-- AlterTable Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "validUntil" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "deliveryTerm" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "preparedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable DeliveryNote
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "partyTaxNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "partyAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "partyCity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "driverName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "plateNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "packages" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryNote" ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentSettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'HamdPharma',
    "legalTitle" TEXT NOT NULL DEFAULT '',
    "taxOffice" TEXT NOT NULL DEFAULT '',
    "taxNo" TEXT NOT NULL DEFAULT '',
    "mersisNo" TEXT NOT NULL DEFAULT '',
    "tradeRegister" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "authorizedName" TEXT NOT NULL DEFAULT '',
    "footerNote" TEXT NOT NULL DEFAULT '',
    "logoDataUrl" TEXT NOT NULL DEFAULT '',
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DocumentSettings" (
  "id",
  "companyName",
  "legalTitle",
  "address",
  "footerNote",
  "updatedAt"
)
VALUES (
  'default',
  'HamdPharma',
  'HamdPharma İlaç San. ve Tic. Ltd. Şti.',
  'Türkiye',
  'Bu belge elektronik ortamda oluşturulmuştur.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
