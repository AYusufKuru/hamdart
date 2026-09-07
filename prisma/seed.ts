/**
 * Başlangıç verilerini yükler.
 *
 * Bu betik EKLEMELİ (additive) ve tekrar çalıştırılabilir (idempotent) çalışır:
 * mevcut kayıtlara dokunmaz, yalnızca eksik olanları ekler. Bu yüzden üretimde
 * kazara ikinci kez çalıştırılması veri kaybına yol açmaz.
 *
 * Veritabanını sıfırdan yüklemek için: npm run db:reset -- --confirm
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import {
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "../src/lib/auth/password-rules";

const prisma = new PrismaClient();

/** src/lib/auth/password.ts ile aynı tutulmalı */
const BCRYPT_ROUNDS = 12;

const importDir = path.join(process.cwd(), "src/data/import");

function loadJson<T>(filename: string): T[] {
  const filePath = path.join(importDir, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T[];
}

/** createMany sonucunu tek satırda raporlar */
function report(label: string, created: number, total: number): void {
  const skipped = total - created;
  const suffix = skipped > 0 ? ` (${skipped} kayıt zaten mevcut, atlandı)` : "";
  console.log(`  ${label}: ${created}/${total} eklendi${suffix}`);
}

async function main() {
  console.log("Başlangıç verileri yükleniyor (eksik kayıtlar eklenir, mevcutlara dokunulmaz)...\n");

  console.log("Depolar...");
  const warehouses = loadJson<Record<string, unknown>>("warehouses.json");
  const typeMap: Record<string, string> = {
    Paketleme: "packaging",
    Üretim: "production",
    Laboratuvar: "laboratory",
    packaging: "packaging",
    production: "production",
    laboratory: "laboratory",
  };
  const warehouseResult = await prisma.warehouse.createMany({
    skipDuplicates: true,
    data: warehouses.map((w) => ({
      id: w.id as string,
      name: w.name as string,
      type: typeMap[w.type as string] ?? "production",
      description: (w.description as string) ?? "",
      location: (w.location as string) ?? "",
      capacity: Number(w.capacity ?? 0),
      used: Number(w.used ?? 0),
      temperature: (w.temperature as string) ?? "",
      humidity: (w.humidity as string) ?? "",
      manager: (w.manager as string) ?? "",
      items: Number(w.items ?? 0),
      lastAudit: (w.lastAudit as string) ?? "",
    })),
  });
  report("Depo", warehouseResult.count, warehouses.length);

  console.log("Hammaddeler...");
  const rawMaterials = loadJson<Record<string, unknown>>("raw-materials.json");
  const BATCH = 500;
  let rawMaterialCreated = 0;
  for (let i = 0; i < rawMaterials.length; i += BATCH) {
    const result = await prisma.rawMaterial.createMany({
      skipDuplicates: true,
      data: rawMaterials.slice(i, i + BATCH).map((m) => ({
        id: m.id as string,
        sku: m.sku as string,
        name: m.name as string,
        category: m.category as string,
        unit: m.unit as string,
        unitCost: Number(m.unitCost ?? 0),
      })),
    });
    rawMaterialCreated += result.count;
  }
  report("Hammadde", rawMaterialCreated, rawMaterials.length);

  console.log("Siparişler, reçeteler, stok...");
  const orders = loadJson<Record<string, unknown>>("orders.json");
  const orderResult = await prisma.order.createMany({
    skipDuplicates: true,
    data: orders.map((o) => ({
      id: o.id as string,
      orderNo: o.orderNo as string,
      customer: o.customer as string,
      product: o.product as string,
      quantity: Number(o.quantity),
      unit: o.unit as string,
      status: o.status as string,
      orderDate: o.orderDate as string,
      deliveryDate: o.deliveryDate as string,
      priority: o.priority as string,
      warehouse: o.warehouse as string,
      value: Number(o.value),
      recipeNo: (o.recipeNo as string) ?? null,
    })),
  });
  report("Sipariş", orderResult.count, orders.length);

  const recipes = loadJson<Record<string, unknown>>("recipes.json");
  const recipeResult = await prisma.recipe.createMany({
    skipDuplicates: true,
    data: recipes.map((r) => ({
      id: r.id as string,
      code: (r.code as string) ?? null,
      productCode: (r.productCode as string) ?? null,
      orderId: (r.orderId as string) ?? "",
      productName: r.productName as string,
      createdAt: r.createdAt as string,
      createdBy: r.createdBy as string,
      lines: JSON.stringify(r.lines ?? []),
      extras: JSON.stringify(r.extras ?? []),
      status: r.status as string,
    })),
  });
  report("Reçete", recipeResult.count, recipes.length);

  const stock = loadJson<Record<string, unknown>>("stock.json");
  const stockResult = await prisma.warehouseStockItem.createMany({
    skipDuplicates: true,
    data: stock.map((s) => ({
      id: s.id as string,
      sku: s.sku as string,
      name: s.name as string,
      category: s.category as string,
      warehouseId: (s.warehouseId as string) ?? "",
      quantity: Number(s.quantity),
      unit: s.unit as string,
      minStock: Number(s.minStock ?? 0),
      maxStock: s.maxStock != null ? Number(s.maxStock) : null,
      lotNo: (s.lotNo as string) ?? "",
      expiryDate: (s.expiryDate as string) ?? "",
      status: (s.status as string) ?? "normal",
      temperature: (s.temperature as string) ?? null,
      replenishFromWarehouseId: (s.replenishFromWarehouseId as string) ?? null,
      labTargetQuantity:
        s.labTargetQuantity != null ? Number(s.labTargetQuantity) : null,
      labDirectEntry: Boolean(s.labDirectEntry),
    })),
  });
  report("Stok kalemi", stockResult.count, stock.length);

  const rmo = loadJson<Record<string, unknown>>("raw-material-orders.json");
  const rmoResult = await prisma.rawMaterialOrder.createMany({
    skipDuplicates: true,
    data: rmo.map((o) => ({
      id: o.id as string,
      orderNo: o.orderNo as string,
      materialName: o.materialName as string,
      sku: o.sku as string,
      supplier: o.supplier as string,
      quantity: Number(o.quantity),
      unit: o.unit as string,
      unitPrice: Number(o.unitPrice),
      totalPrice: Number(o.totalPrice),
      status: o.status as string,
      source: o.source as string,
      sourceNote: (o.sourceNote as string) ?? null,
      targetWarehouseId: o.targetWarehouseId as string,
      orderDate: o.orderDate as string,
      expectedDelivery: (o.expectedDelivery as string) ?? null,
      receivedDate: (o.receivedDate as string) ?? null,
      qcStartedAt: (o.qcStartedAt as string) ?? null,
      qcCompletedAt: (o.qcCompletedAt as string) ?? null,
      warehousedAt: (o.warehousedAt as string) ?? null,
      returnedAt: (o.returnedAt as string) ?? null,
      lotNo: (o.lotNo as string) ?? null,
      invoiceNo: (o.invoiceNo as string) ?? null,
      qcNotes: (o.qcNotes as string) ?? null,
      qcAnalyst: (o.qcAnalyst as string) ?? null,
    })),
  });
  report("Hammadde siparişi", rmoResult.count, rmo.length);

  const lines = loadJson<Record<string, unknown>>("production-lines.json");
  const lineResult = await prisma.productionLine.createMany({
    skipDuplicates: true,
    data: lines.map((l) => ({
      id: l.id as string,
      code: (l.code as string) ?? null,
      name: l.name as string,
      product: l.product as string,
      status: l.status as string,
      efficiency: Number(l.efficiency),
      currentBatch: l.currentBatch as string,
      outputToday: Number(l.outputToday),
      targetToday: Number(l.targetToday),
      operator: l.operator as string,
      lastMaintenance: l.lastMaintenance as string,
    })),
  });
  report("Üretim hattı", lineResult.count, lines.length);

  const batches = loadJson<Record<string, unknown>>("production-batches.json");
  const batchResult = await prisma.productionBatch.createMany({
    skipDuplicates: true,
    data: batches.map((b) => ({
      id: b.id as string,
      batchNo: b.batchNo as string,
      product: b.product as string,
      line: b.line as string,
      status: b.status as string,
      quantity: Number(b.quantity),
      unit: b.unit as string,
      startDate: b.startDate as string,
      endDate: b.endDate as string,
      yield: Number(b.yield),
      qcScore: Number(b.qcScore),
    })),
  });
  report("Üretim partisi", batchResult.count, batches.length);

  console.log("Katalog verileri...");
  const customers = loadJson<Record<string, unknown>>("customers.json");
  let customerCreated = 0;
  for (let i = 0; i < customers.length; i += BATCH) {
    const result = await prisma.customer.createMany({
      skipDuplicates: true,
      data: customers.slice(i, i + BATCH).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        contact: (c.contact as string) ?? "",
        address: (c.address as string) ?? "",
        taxNo: (c.taxNo as string) ?? "",
        email: (c.email as string) ?? "",
      })),
    });
    customerCreated += result.count;
  }
  report("Müşteri", customerCreated, customers.length);

  const suppliers = loadJson<Record<string, unknown>>("suppliers.json");
  let supplierCreated = 0;
  for (let i = 0; i < suppliers.length; i += BATCH) {
    const result = await prisma.supplier.createMany({
      skipDuplicates: true,
      data: suppliers.slice(i, i + BATCH).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        contact: (s.contact as string) ?? "",
        address: (s.address as string) ?? "",
      })),
    });
    supplierCreated += result.count;
  }
  report("Tedarikçi", supplierCreated, suppliers.length);

  const personnel = loadJson<Record<string, unknown>>("personnel.json");
  const personnelResult = await prisma.personnel.createMany({
    skipDuplicates: true,
    data: personnel.map((p) => ({
      id: p.id as string,
      firstName: p.firstName as string,
      lastName: p.lastName as string,
      department: p.department as string,
      title: p.title as string,
      email: p.email as string,
      phone: p.phone as string,
      hireDate: p.hireDate as string,
      salary: Number(p.salary),
      iban: p.iban as string,
    })),
  });
  report("Personel", personnelResult.count, personnel.length);

  const products = loadJson<Record<string, unknown>>("products.json");
  const productResult = await prisma.finishedProduct.createMany({
    skipDuplicates: true,
    data: products.map((p) => ({
      id: p.id as string,
      sku: p.sku as string,
      name: p.name as string,
      unit: p.unit as string,
      minStock: Number(p.minStock),
      maxStock: Number(p.maxStock),
      lotNo: p.lotNo as string,
      expiryDate: p.expiryDate as string,
    })),
  });
  report("Mamul ürün", productResult.count, products.length);

  const invoices = loadJson<Record<string, unknown>>("invoices.json");
  const invoiceResult = await prisma.invoice.createMany({
    skipDuplicates: true,
    data: invoices.map((inv) => ({
      id: inv.id as string,
      invoiceNo: inv.invoiceNo as string,
      party: inv.party as string,
      kind: inv.kind as string,
      issueDate: inv.issueDate as string,
      dueDate: inv.dueDate as string,
      amount: Number(inv.amount),
      status: inv.status as string,
    })),
  });
  report("Fatura", invoiceResult.count, invoices.length);

  const invoiceLines = loadJson<Record<string, unknown>>("invoice-lines.json");
  const invoiceLineResult = await prisma.invoiceLine.createMany({
    skipDuplicates: true,
    data: invoiceLines.map((l) => ({
      id: l.id as string,
      invoiceNo: l.invoiceNo as string,
      description: l.description as string,
      quantityLabel: l.quantityLabel as string,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  });
  report("Fatura satırı", invoiceLineResult.count, invoiceLines.length);

  const ledger = loadJson<Record<string, unknown>>("ledger.json");
  const ledgerResult = await prisma.ledgerEntry.createMany({
    skipDuplicates: true,
    data: ledger.map((l) => ({
      id: l.id as string,
      date: l.date as string,
      documentNo: l.documentNo as string,
      description: l.description as string,
      category: l.category as string,
      direction: l.direction as string,
      amount: Number(l.amount),
      status: l.status as string,
    })),
  });
  report("Yevmiye kaydı", ledgerResult.count, ledger.length);

  const budget = loadJson<Record<string, unknown>>("budget.json");
  const budgetResult = await prisma.budgetRow.createMany({
    skipDuplicates: true,
    data: budget.map((b) => ({
      id: b.id as string,
      department: b.department as string,
      annual: Number(b.annual),
      spent: Number(b.spent),
    })),
  });
  report("Bütçe satırı", budgetResult.count, budget.length);

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
