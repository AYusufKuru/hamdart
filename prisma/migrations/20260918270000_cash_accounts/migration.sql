-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "openingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bankName" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "branch" TEXT NOT NULL DEFAULT '',
    "accountNo" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashAccount_kind_idx" ON "CashAccount"("kind");

INSERT INTO "CashAccount" (
  "id", "kind", "name", "locked", "currency", "openingBalance",
  "bankName", "iban", "branch", "accountNo", "notes", "active",
  "createdAt", "updatedAt"
) VALUES
  (
    'cash-istanbul',
    'cash',
    'İstanbul kasa',
    true,
    'TRY',
    0,
    '',
    '',
    '',
    '',
    '',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cash-kastamonu',
    'cash',
    'Kastamonu kasa',
    true,
    'TRY',
    0,
    '',
    '',
    '',
    '',
    '',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
