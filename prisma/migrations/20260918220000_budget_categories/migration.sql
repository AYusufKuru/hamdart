CREATE TABLE IF NOT EXISTS "BudgetCategory" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetCategory_direction_name_key" ON "BudgetCategory"("direction", "name");
CREATE INDEX IF NOT EXISTS "BudgetCategory_direction_idx" ON "BudgetCategory"("direction");

INSERT INTO "BudgetCategory" ("id", "direction", "name") VALUES
  ('bcat-in-1', 'gelir', 'Satış tahsilatı'),
  ('bcat-in-2', 'gelir', 'Hizmet'),
  ('bcat-in-3', 'gelir', 'Kira'),
  ('bcat-in-4', 'gelir', 'Diğer gelir'),
  ('bcat-out-1', 'gider', 'Kasa avansı'),
  ('bcat-out-2', 'gider', 'Market'),
  ('bcat-out-3', 'gider', 'Çay / kahve'),
  ('bcat-out-4', 'gider', 'Ulaşım'),
  ('bcat-out-5', 'gider', 'Fatura'),
  ('bcat-out-6', 'gider', 'Maaş'),
  ('bcat-out-7', 'gider', 'Diğer gider')
ON CONFLICT ("direction", "name") DO NOTHING;
