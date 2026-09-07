/**
 * TÜM VERİTABANI İÇERİĞİNİ SİLER. Geri dönüşü yoktur.
 *
 * Kullanım (yalnızca geliştirme):
 *   npm run db:reset -- --confirm
 *
 * Üretimde çalışmayı reddeder. Gerçekten gerekiyorsa ortam değişkeni ile
 * açıkça izin verilmelidir:
 *   ALLOW_PROD_RESET=yes npm run db:reset -- --confirm
 *
 * Sıfırlama sonrası başlangıç verilerini yüklemek için: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Silme sırası önemli: bağımlı kayıtlar önce gider */
const DELETION_ORDER = [
  "auditLog",
  "backupRecord",
  "user",
  "invoiceLine",
  "invoice",
  "ledgerEntry",
  "budgetRow",
  "labSample",
  "labExperiment",
  "productionBatch",
  "productionLine",
  "stockTransfer",
  "warehouseStockItem",
  "rawMaterialOrder",
  "recipe",
  "order",
  "rawMaterial",
  "finishedProduct",
  "customer",
  "supplier",
  "personnel",
  "warehouse",
] as const;

type ModelName = (typeof DELETION_ORDER)[number];

function delegate(model: ModelName) {
  return prisma[model] as unknown as {
    count: () => Promise<number>;
    deleteMany: () => Promise<{ count: number }>;
  };
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const isProduction = process.env.NODE_ENV === "production";
  const prodOverride = process.env.ALLOW_PROD_RESET === "yes";

  if (isProduction && !prodOverride) {
    console.error(
      "REDDEDİLDİ: NODE_ENV=production. Üretim veritabanı bu betikle silinemez.\n" +
        "Gerçekten gerekiyorsa: ALLOW_PROD_RESET=yes npm run db:reset -- --confirm"
    );
    process.exit(1);
  }

  if (!confirmed) {
    console.error(
      "REDDEDİLDİ: Bu betik TÜM veritabanı içeriğini siler.\n" +
        "Onaylamak için: npm run db:reset -- --confirm"
    );
    process.exit(1);
  }

  console.log("Mevcut kayıt sayıları:");
  let total = 0;
  for (const model of DELETION_ORDER) {
    const count = await delegate(model).count();
    total += count;
    if (count > 0) console.log(`  ${model}: ${count}`);
  }

  if (total === 0) {
    console.log("Veritabanı zaten boş. Yapılacak bir şey yok.");
    return;
  }

  if (isProduction) {
    console.log(
      `\nUYARI: ÜRETİM veritabanında ${total} kayıt siliniyor. 5 saniye içinde Ctrl+C ile iptal edebilirsiniz...`
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log(`\n${total} kayıt siliniyor...`);
  for (const model of DELETION_ORDER) {
    const { count } = await delegate(model).deleteMany();
    if (count > 0) console.log(`  ${model}: ${count} silindi`);
  }

  console.log("\nVeritabanı sıfırlandı. Başlangıç verileri için: npm run db:seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
