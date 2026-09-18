INSERT INTO "BudgetCategory" ("id", "direction", "name") VALUES
  ('bcat-in-cek', 'gelir', 'Çek'),
  ('bcat-in-senet', 'gelir', 'Senet')
ON CONFLICT ("direction", "name") DO NOTHING;
