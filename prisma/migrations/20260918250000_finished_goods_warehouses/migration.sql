INSERT INTO "Warehouse" (
  "id", "name", "type", "description", "location", "capacity", "used",
  "temperature", "humidity", "manager", "items", "lastAudit"
)
VALUES
  (
    'wh-mamul-fabrika',
    'Fabrika (Mamul)',
    'finished',
    'Üretimden çıkan mamul stoğu. İnternet satışına doğrudan, İstanbul deposuna sevkiyat ile aktarılır.',
    'Fabrika',
    50000,
    0,
    '15-25°C',
    '%40-60',
    'Depo Sorumlusu',
    0,
    ''
  ),
  (
    'wh-mamul-internet',
    'İnternet satışı',
    'finished',
    'E-ticaret mamul deposu. Fabrika mamul stoğu ile doğrudan aktarılır.',
    'Fabrika / Online',
    20000,
    0,
    '15-25°C',
    '%40-60',
    'Depo Sorumlusu',
    0,
    ''
  ),
  (
    'wh-mamul-istanbul',
    'İstanbul deposu',
    'finished',
    'İstanbul mamul deposu. Stok ayrılır, sevkiyat onaylanır, yola çıkar; varışta stoğa geçer.',
    'İstanbul',
    30000,
    0,
    '15-25°C',
    '%40-60',
    'Depo Sorumlusu',
    0,
    ''
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "WarehouseStockItem"
SET "warehouseId" = 'wh-mamul-fabrika'
WHERE "warehouseId" = 'wh-fabrika'
  AND lower("category") = 'mamul';
