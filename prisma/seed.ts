/**
 * Başlangıç verilerini yükler.
 *
 * Kaynak: yalnızca prisma/data/hamdart-veri.xlsx
 * (istemciye JSON gömülmez; sunucu kurulumunda bu dosya okunur.)
 *
 * Bu betik EKLEMELİ (additive) ve tekrar çalıştırılabilir (idempotent):
 * mevcut kayıtlara dokunmaz, yalnızca eksik olanları ekler.
 *
 * Veritabanını sıfırdan yüklemek için: npm run db:reset -- --confirm
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "../src/lib/auth/password-rules";
import { loadSeedFromExcel, resolveExcelPath } from "./load-excel";

const prisma = new PrismaClient();

/** src/lib/auth/password.ts ile aynı tutulmalı */
const BCRYPT_ROUNDS = 12;
const BATCH = 500;

function report(label: string, created: number, total: number): void {
  const skipped = total - created;
  const suffix = skipped > 0 ? ` (${skipped} kayıt zaten mevcut, atlandı)` : "";
  console.log(`  ${label}: ${created}/${total} eklendi${suffix}`);
}

async function createBatched<T extends object>(
  label: string,
  rows: T[],
  insert: (chunk: T[]) => Promise<{ count: number }>
): Promise<void> {
  let created = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const result = await insert(rows.slice(i, i + BATCH));
    created += result.count;
  }
  report(label, created, rows.length);
}

async function main() {
  const excelPath = resolveExcelPath();
  console.log(`Başlangıç verileri Excel'den yükleniyor:\n  ${excelPath}\n`);
  const data = loadSeedFromExcel(excelPath);

  console.log("Depolar...");
  await createBatched("Depo", data.warehouses, (chunk) =>
    prisma.warehouse.createMany({ skipDuplicates: true, data: chunk })
  );

  console.log("Hammaddeler...");
  await createBatched("Hammadde", data.rawMaterials, (chunk) =>
    prisma.rawMaterial.createMany({ skipDuplicates: true, data: chunk })
  );

  console.log("Siparişler, reçeteler, stok...");
  await createBatched("Sipariş", data.orders, (chunk) =>
    prisma.order.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Reçete", data.recipes, (chunk) =>
    prisma.recipe.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Stok kalemi", data.stock, (chunk) =>
    prisma.warehouseStockItem.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Hammadde siparişi", data.rawMaterialOrders, (chunk) =>
    prisma.rawMaterialOrder.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Üretim hattı", data.productionLines, (chunk) =>
    prisma.productionLine.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Üretim partisi", data.productionBatches, (chunk) =>
    prisma.productionBatch.createMany({ skipDuplicates: true, data: chunk })
  );

  console.log("Katalog verileri...");
  await createBatched("Müşteri", data.customers, (chunk) =>
    prisma.customer.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Tedarikçi", data.suppliers, (chunk) =>
    prisma.supplier.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Personel", data.personnel, (chunk) =>
    prisma.personnel.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Mamul ürün", data.products, (chunk) =>
    prisma.finishedProduct.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Fatura", data.invoices, (chunk) =>
    prisma.invoice.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Fatura satırı", data.invoiceLines, (chunk) =>
    prisma.invoiceLine.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Yevmiye kaydı", data.ledger, (chunk) =>
    prisma.ledgerEntry.createMany({ skipDuplicates: true, data: chunk })
  );
  await createBatched("Bütçe satırı", data.budget, (chunk) =>
    prisma.budgetRow.createMany({ skipDuplicates: true, data: chunk })
  );

  await seedAdminUser();

  console.log("\nSeed tamamlandı.");
}

const ADMIN_USERNAME = "admin";

/**
 * Tek yönetici hesabını oluşturur. Şifre .env dosyasındaki
 * ADMIN_INITIAL_PASSWORD değerinden okunur; hesap ilk girişte şifre
 * değiştirmeye zorlanır.
 */
async function seedAdminUser(): Promise<void> {
  console.log("\nYönetici hesabı...");

  const existing = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
  });
  if (existing) {
    console.log(
      `  ${ADMIN_USERNAME}: zaten mevcut, atlandı (şifresine dokunulmadı)`
    );
    return;
  }

  const password = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD tanımlı değil.\n" +
        "  .env dosyasına yönetici hesabının ilk şifresini ekleyin, örnek:\n" +
        '    ADMIN_INITIAL_PASSWORD="BurayaGuclu1Sifre"\n' +
        `  Kural: ${PASSWORD_RULES_TEXT}`
    );
  }

  const problem = validatePassword(password, {
    username: ADMIN_USERNAME,
    name: "Sistem Yöneticisi",
  });
  if (problem) {
    throw new Error(
      `ADMIN_INITIAL_PASSWORD politikaya uymuyor: ${problem}\n` +
        "  .env dosyasındaki değeri düzeltip tekrar deneyin."
    );
  }

  await prisma.user.create({
    data: {
      username: ADMIN_USERNAME,
      name: "Sistem Yöneticisi",
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  console.log(`  ${ADMIN_USERNAME} (ADMIN) oluşturuldu.`);
  console.log(
    "  Şifre: .env dosyasındaki ADMIN_INITIAL_PASSWORD değeri.\n" +
      "  İlk girişte şifre değiştirme ekranı zorunlu olarak açılacak.\n" +
      "  Diğer kullanıcıları Denetim & Yedekleme > Kullanıcılar ekranından oluşturun."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
