/**
 * Kurulum verisi yalnızca prisma/data/hamdart-veri.xlsx dosyasından gelir.
 * İstemciye JSON gömülmez; bu modül yalnızca seed betiğinde kullanılır.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export type WarehouseSeed = {
  id: string;
  name: string;
  type: string;
  description: string;
  location: string;
  capacity: number;
  used: number;
  temperature: string;
  humidity: string;
  manager: string;
  items: number;
  lastAudit: string;
};

export type ExcelSeed = {
  warehouses: WarehouseSeed[];
  rawMaterials: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: string;
    unitCost: number;
  }>;
  orders: Array<{
    id: string;
    orderNo: string;
    customer: string;
    product: string;
    quantity: number;
    unit: string;
    status: string;
    orderDate: string;
    deliveryDate: string;
    priority: string;
    warehouse: string;
    value: number;
    recipeNo: string | null;
  }>;
  recipes: Array<{
    id: string;
    code: string | null;
    productCode: string | null;
    orderId: string;
    productName: string;
    createdAt: string;
    createdBy: string;
    lines: string;
    extras: string;
    status: string;
  }>;
  stock: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    warehouseId: string;
    quantity: number;
    unit: string;
    minStock: number;
    maxStock: number | null;
    lotNo: string;
    expiryDate: string;
    status: string;
    temperature: string | null;
    replenishFromWarehouseId: string | null;
    labTargetQuantity: number | null;
    labDirectEntry: boolean;
  }>;
  rawMaterialOrders: Array<{
    id: string;
    orderNo: string;
    materialName: string;
    sku: string;
    supplier: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    status: string;
    source: string;
    sourceNote: string | null;
    targetWarehouseId: string;
    orderDate: string;
    expectedDelivery: string | null;
    receivedDate: string | null;
    qcStartedAt: string | null;
    qcCompletedAt: string | null;
    warehousedAt: string | null;
    returnedAt: string | null;
    lotNo: string | null;
    invoiceNo: string | null;
    qcNotes: string | null;
    qcAnalyst: string | null;
  }>;
  productionLines: Array<{
    id: string;
    code: string | null;
    name: string;
    product: string;
    status: string;
    efficiency: number;
    currentBatch: string;
    outputToday: number;
    targetToday: number;
    operator: string;
    lastMaintenance: string;
  }>;
  productionBatches: Array<{
    id: string;
    batchNo: string;
    product: string;
    line: string;
    status: string;
    quantity: number;
    unit: string;
    startDate: string;
    endDate: string;
    yield: number;
    qcScore: number;
  }>;
  customers: Array<{
    id: string;
    name: string;
    contact: string;
    address: string;
    taxNo: string;
    email: string;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    contact: string;
    address: string;
  }>;
  personnel: Array<{
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    title: string;
    email: string;
    phone: string;
    hireDate: string;
    salary: number;
    iban: string;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    unit: string;
    minStock: number;
    maxStock: number;
    lotNo: string;
    expiryDate: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNo: string;
    party: string;
    kind: string;
    issueDate: string;
    dueDate: string;
    amount: number;
    status: string;
  }>;
  invoiceLines: Array<{
    id: string;
    invoiceNo: string;
    description: string;
    quantityLabel: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  ledger: Array<{
    id: string;
    date: string;
    documentNo: string;
    description: string;
    category: string;
    direction: string;
    amount: number;
    status: string;
  }>;
  budget: Array<{
    id: string;
    department: string;
    annual: number;
    spent: number;
  }>;
};

const TYPE_MAP: Record<string, string> = {
  Paketleme: "packaging",
  Üretim: "production",
  Laboratuvar: "laboratory",
  packaging: "packaging",
  production: "production",
  laboratory: "laboratory",
};

const ORDER_STATUS: Record<string, string> = {
  bekliyor: "pending",
  onaylandı: "confirmed",
  onaylandi: "confirmed",
  toplanıyor: "picking",
  "sevk edildi": "shipped",
  "teslim edildi": "delivered",
  iptal: "cancelled",
};

const RMO_STATUS: Record<string, string> = {
  bekliyor: "to_order",
  "sipariş verilecek": "to_order",
  "sipariş verildi": "ordered",
  geldi: "received",
  geliş: "received",
  kk: "qc_pending",
  onay: "warehoused",
  red: "qc_failed",
  iade: "returned",
};

const RMO_SOURCE: Record<string, string> = {
  "düşük stok": "low_stock",
  üretim: "production_need",
  manuel: "manual",
};

/** Excel şablonunda kalan örnek satırlar — gerçek Hamdard kaydı değil */
const TEMPLATE_MARKERS = [
  "cardiomax",
  "neurorelief",
  "örnek eczane",
  "ornek eczane",
  "örnek kimya",
  "ornek kimya",
  "medicare",
];

export function resolveExcelPath(): string {
  const fromEnv = process.env.SEED_XLSX?.trim();
  const candidates = [
    fromEnv,
    path.join(process.cwd(), "prisma/data/hamdart-veri.xlsx"),
    path.join(process.cwd(), "prisma", "data", "hamdart-veri.xlsx"),
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  throw new Error(
    "Kurulum Excel dosyası bulunamadı.\n" +
      "  Beklenen yol: prisma/data/hamdart-veri.xlsx\n" +
      "  veya SEED_XLSX ortam değişkeni ile tam dosya yolu."
  );
}

function cell(row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key];
  const found = Object.keys(row).find((k) => k.trim() === key);
  return found ? row[found] : undefined;
}

function str(row: Record<string, unknown>, key: string): string {
  const v = cell(row, key);
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return dateIso(v);
  return String(v).trim();
}

function num(row: Record<string, unknown>, key: string, fallback = 0): number {
  const v = cell(row, key);
  if (v == null || v === "") return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, "").replace("₺", "").replace(",", ".");
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
    const d = new Date(epoch);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim().replace(",", ".");
  const full = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(s);
  if (full) {
    return `${full[1]}-${pad(Number(full[2]))}-${pad(Number(full[3]))}`;
  }
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  if (s.length >= 10 && s[4] === "-") return s.slice(0, 10);
  return s;
}

function dateCell(row: Record<string, unknown>, key: string): string {
  return dateIso(cell(row, key));
}

function slug(input: string): string {
  const tr: Record<string, string> = {
    ı: "i",
    İ: "i",
    ş: "s",
    Ş: "s",
    ğ: "g",
    Ğ: "g",
    ü: "u",
    Ü: "u",
    ö: "o",
    Ö: "o",
    ç: "c",
    Ç: "c",
  };
  let s = "";
  for (const ch of input) s += tr[ch] ?? ch;
  s = s.normalize("NFKD").replace(/\p{M}/gu, "");
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "x";
}

function isTemplate(...parts: unknown[]): boolean {
  const blob = parts.map((p) => String(p ?? "")).join(" ").toLocaleLowerCase("tr");
  return TEMPLATE_MARKERS.some((m) => blob.includes(m));
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });
  return rows
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) out[k.trim()] = v;
      return out;
    })
    .filter((row) =>
      Object.values(row).some((v) => v != null && String(v).trim() !== "")
    );
}

function warehouseType(raw: string): string {
  return TYPE_MAP[raw] ?? TYPE_MAP[raw.trim()] ?? "production";
}

function mapWarehouse(code: string, warehouses: WarehouseSeed[]): string {
  const original = (code || "").trim();
  const c = original.toLocaleUpperCase("tr").replace(/İ/g, "I");
  if (!c) return "wh-fabrika";
  if (c.includes("LAB")) return "wh-laboratory";
  if (slug(original).includes("sise") || c.includes("ŞIŞE") || c.includes("SISE")) {
    return warehouses.find((w) => w.id.includes("sise"))?.id ?? "wh-fabrika";
  }
  if (c.includes("AMBALAJ")) {
    return (
      warehouses.find((w) => w.id.startsWith("wh-ambalaj"))?.id ?? "wh-fabrika"
    );
  }
  if (c.includes("FABRIKA") || c.includes("ANA DEPO")) return "wh-fabrika";
  return "wh-fabrika";
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function loadSeedFromExcel(filePath = resolveExcelPath()): ExcelSeed {
  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });

  const warehouses: WarehouseSeed[] = [];
  const seenWh = new Set<string>();
  sheetRows(wb, "Depo").forEach((r, i) => {
    const name = str(r, "Depo Adı");
    if (!name) return;
    const desc = str(r, "Açıklama");
    let id = `wh-${slug(name)}`;
    if (desc) {
      const candidate = `${id}-${slug(desc)}`;
      if (!seenWh.has(candidate)) id = candidate;
    }
    if (seenWh.has(id)) id = `${id}-${i + 1}`;
    seenWh.add(id);
    warehouses.push({
      id,
      name: desc ? `${name} (${desc})` : name,
      type: warehouseType(str(r, "Tip") || "Paketleme"),
      description: desc,
      location: str(r, "Konum"),
      capacity: num(r, "Kapasite"),
      used: 0,
      temperature: str(r, "Sıcaklık"),
      humidity: str(r, "Nem"),
      manager: str(r, "Sorumlu"),
      items: 0,
      lastAudit: "",
    });
  });

  const ensureWarehouse = (row: WarehouseSeed) => {
    if (warehouses.some((w) => w.id === row.id)) return;
    warehouses.push(row);
  };
  ensureWarehouse({
    id: "wh-fabrika",
    name: "Fabrika",
    type: "production",
    description: "Fabrika deposu",
    location: "Fabrika",
    capacity: 0,
    used: 0,
    temperature: "15-25°C",
    humidity: "",
    manager: "",
    items: 0,
    lastAudit: "",
  });
  ensureWarehouse({
    id: "wh-laboratory",
    name: "Laboratuvar Deposu",
    type: "laboratory",
    description: "Ar-Ge ve kalite kontrol",
    location: "Fabrika",
    capacity: 500,
    used: 0,
    temperature: "18-22°C",
    humidity: "40-50%",
    manager: "",
    items: 0,
    lastAudit: "",
  });

  const warehouseIds = new Set(warehouses.map((w) => w.id));

  const rawMaterials: ExcelSeed["rawMaterials"] = [];
  const skuIds = new Map<string, string>();
  const nameToId = new Map<string, string>();
  const usedRmIds = new Set<string>();
  sheetRows(wb, "Hammadde").forEach((r, i) => {
    const sku = str(r, "SKU") || `SKU-${i + 1}`;
    const skuKey = sku.toLocaleLowerCase("tr");
    if (skuIds.has(skuKey)) return;
    let id = sku ? `rm-${slug(sku)}` : `rm-${i + 1}`;
    if (usedRmIds.has(id)) id = `${id}-${i + 1}`;
    usedRmIds.add(id);
    skuIds.set(skuKey, id);
    const name = str(r, "Malzeme Adı");
    rawMaterials.push({
      id,
      sku,
      name,
      category: str(r, "Kategori") || "Diğer",
      unit: (str(r, "Birim") || "adet").toLocaleLowerCase("tr"),
      unitCost: 0,
    });
    if (name) nameToId.set(name.toLocaleLowerCase("tr"), id);
  });

  const products: ExcelSeed["products"] = [];
  sheetRows(wb, "Mamul_Urun").forEach((r, i) => {
    const name = str(r, "Ürün Adı");
    const sku = str(r, "SKU");
    if (!name && !sku) return;
    products.push({
      id: `prd-${i + 1}`,
      sku,
      name,
      unit: (str(r, "Birim") || "kutu").toLocaleLowerCase("tr"),
      minStock: num(r, "Min Stok"),
      maxStock: num(r, "Max Stok"),
      lotNo: str(r, "Parti No"),
      expiryDate: dateCell(r, "STT"),
    });
  });

  const stock: ExcelSeed["stock"] = [];
  sheetRows(wb, "Stok").forEach((r, i) => {
    const qty = num(r, "Miktar");
    const mn = num(r, "Min Stok");
    let status = "normal";
    if (mn > 0 && qty < mn * 0.5) status = "critical";
    else if (mn > 0 && qty < mn) status = "low";
    const warehouseId = mapWarehouse(str(r, "Depo Kodu"), warehouses);
    stock.push({
      id: `stk-${i + 1}`,
      sku: str(r, "SKU"),
      name: str(r, "Ürün / Malzeme Adı"),
      category: str(r, "Kategori"),
      warehouseId: warehouseIds.has(warehouseId) ? warehouseId : "wh-fabrika",
      quantity: qty,
      unit: str(r, "Birim").toLocaleLowerCase("tr"),
      minStock: mn,
      maxStock: (() => {
        const n = num(r, "Max Stok");
        return n > 0 ? n : null;
      })(),
      lotNo: str(r, "Lot No-Parti"),
      expiryDate: dateCell(r, "Son Kullanma Tarihi"),
      status,
      temperature: str(r, "Sıcaklık (opsiyonel)") || null,
      replenishFromWarehouseId: null,
      labTargetQuantity: null,
      labDirectEntry: false,
    });
  });

  const suppliers: ExcelSeed["suppliers"] = [];
  sheetRows(wb, "Tedarikçiler").forEach((r, i) => {
    const name = str(r, "Firma Adı");
    if (!name) return;
    suppliers.push({
      id: `sup-${i + 1}`,
      name,
      contact: str(r, "İletişim"),
      address: str(r, "Adres"),
    });
  });

  const customers: ExcelSeed["customers"] = [];
  sheetRows(wb, "Müşteriler").forEach((r, i) => {
    const name = str(r, "Müşteri Adı");
    if (!name) return;
    customers.push({
      id: `cus-${i + 1}`,
      name,
      contact: str(r, "İletişim"),
      address: str(r, "Adres"),
      taxNo: str(r, "Vergi No"),
      email: str(r, "E-posta"),
    });
  });

  const invoices: ExcelSeed["invoices"] = [];
  const invoiceNos = new Set<string>();
  sheetRows(wb, "Cari_Acik").forEach((r, i) => {
    const invoiceNo = str(r, "Fatura No");
    if (!invoiceNo || invoiceNos.has(invoiceNo)) return;
    invoiceNos.add(invoiceNo);
    invoices.push({
      id: `inv-${i + 1}`,
      invoiceNo,
      party: str(r, "Müşteri / Tedarikçi"),
      kind: str(r, "Tür"),
      issueDate: dateCell(r, "Düzenleme Tarihi"),
      dueDate: dateCell(r, "Vade Tarihi"),
      amount: num(r, "Tutar (₺)"),
      status: str(r, "Durum"),
    });
  });

  const invoiceLines: ExcelSeed["invoiceLines"] = [];
  sheetRows(wb, "Cari_Fatura_Kalemleri").forEach((r, i) => {
    const invoiceNo = str(r, "Fatura No");
    if (!invoiceNo || !invoiceNos.has(invoiceNo)) return;
    invoiceLines.push({
      id: `il-${i + 1}`,
      invoiceNo,
      description: str(r, "Kalem Açıklaması"),
      quantityLabel: str(r, "Miktar"),
      unitPrice: num(r, "Birim Fiyat (₺)"),
      lineTotal: num(r, "Kalem Toplam (₺)"),
    });
  });

  const rawMaterialOrders: ExcelSeed["rawMaterialOrders"] = [];
  sheetRows(wb, "Hammadde_Siparisleri").forEach((r, i) => {
    const name = str(r, "Malzeme Adı");
    if (!name || isTemplate(name, str(r, "Tedarikçi"), str(r, "Sipariş No"))) return;
    const st = str(r, "Durum").toLocaleLowerCase("tr");
    const src = str(r, "Kaynak").toLocaleLowerCase("tr");
    const mid = nameToId.get(name.toLocaleLowerCase("tr")) ?? "";
    const sku = rawMaterials.find((m) => m.id === mid)?.sku ?? "";
    const targetWarehouseId = mapWarehouse(str(r, "Hedef Depo Kodu"), warehouses);
    rawMaterialOrders.push({
      id: `rmo-${i + 1}`,
      orderNo: str(r, "Sipariş No") || `HM-2026-${String(i + 1).padStart(4, "0")}`,
      materialName: name,
      sku,
      supplier: str(r, "Tedarikçi"),
      quantity: num(r, "Miktar"),
      unit: (str(r, "Birim") || "kg").toLocaleLowerCase("tr"),
      unitPrice: num(r, "Birim Fiyat (₺)"),
      totalPrice: num(r, "Toplam (₺)"),
      status: RMO_STATUS[st] ?? (st ? "received" : "to_order"),
      source: RMO_SOURCE[src] ?? (src ? "low_stock" : "manual"),
      sourceNote: str(r, "Kaynak Notu") || null,
      targetWarehouseId: warehouseIds.has(targetWarehouseId)
        ? targetWarehouseId
        : "wh-fabrika",
      orderDate: dateCell(r, "Sipariş Tarihi") || dateCell(r, "Beklenen Teslimat"),
      expectedDelivery: dateCell(r, "Beklenen Teslimat") || null,
      receivedDate: dateCell(r, "Teslim Alma Tarihi") || null,
      qcStartedAt: dateCell(r, "KK Başlangıç") || null,
      qcCompletedAt: dateCell(r, "KK Bitiş") || null,
      warehousedAt: dateCell(r, "Depo Giriş Tarihi") || null,
      returnedAt: dateCell(r, "İade Tarihi") || null,
      lotNo: str(r, "Lot No") || null,
      invoiceNo: str(r, "Fatura No") || null,
      qcAnalyst: str(r, "KK Analist") || null,
      qcNotes: str(r, "KK Notları") || null,
    });
  });

  const orders: ExcelSeed["orders"] = [];
  sheetRows(wb, "Müşteri_Siparişleri").forEach((r, i) => {
    if (isTemplate(str(r, "Müşteri Adı"), str(r, "Ürün Adı"), str(r, "Sipariş No"))) {
      return;
    }
    const customer = str(r, "Müşteri Adı");
    const product = str(r, "Ürün Adı");
    if (!customer && !product) return;
    const st = str(r, "Durumu").toLocaleLowerCase("tr");
    let pri = (str(r, "Öncelik") || "normal").toLocaleLowerCase("tr");
    if (pri !== "normal" && pri !== "high" && pri !== "urgent") pri = "normal";
    orders.push({
      id: `o-${i + 1}`,
      orderNo: str(r, "Sipariş No") || `SIP-${i + 1}`,
      customer,
      product,
      quantity: num(r, "Miktar"),
      unit: (str(r, "Birim") || "kutu").toLocaleLowerCase("tr"),
      status: ORDER_STATUS[st] ?? "confirmed",
      orderDate: dateCell(r, "Sipariş Tarihi"),
      deliveryDate: dateCell(r, "Teslim Tarihi"),
      priority: pri,
      warehouse: "",
      value: num(r, "Tutar (₺)"),
      recipeNo: str(r, "Reçete No") || null,
    });
  });

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const r of sheetRows(wb, "Reçete")) {
    const pname = str(r, "Ürün adı");
    if (!pname) continue;
    const list = grouped.get(pname) ?? [];
    list.push(r);
    grouped.set(pname, list);
  }
  const recipes: ExcelSeed["recipes"] = [];
  let recI = 0;
  for (const [pname, rows] of grouped) {
    recI += 1;
    const first = rows[0]!;
    const lines = rows.map((r) => {
      const mname = str(r, "Hammadde adı");
      return {
        materialId: nameToId.get(mname.toLocaleLowerCase("tr")) ?? "",
        materialName: mname,
        unit: str(r, "Birim"),
        quantityPerUnit: num(r, "Birim Miktar"),
      };
    });
    recipes.push({
      id: `rec-${recI}`,
      code: str(first, "Reçete Kodu") || `REC-${String(recI).padStart(3, "0")}`,
      productCode: str(first, "Ürün Kodu") || null,
      orderId: "",
      productName: pname,
      createdAt: "2026-01-01",
      createdBy: "Sistem",
      lines: JSON.stringify(lines),
      extras: JSON.stringify([]),
      status: "saved",
    });
  }

  const productionLines: ExcelSeed["productionLines"] = [];
  const productionBatches: ExcelSeed["productionBatches"] = [];
  const usedLineIds = new Set<string>();
  const usedBatchNos = new Set<string>();
  sheetRows(wb, "Uretim_Hatlari").forEach((r, i) => {
    const code = str(r, "Makine Kodu") || `M${String(i + 1).padStart(3, "0")}`;
    let id = code.toLocaleLowerCase("tr");
    if (usedLineIds.has(id)) id = `${id}-${i + 1}`;
    usedLineIds.add(id);
    const batchNo = str(r, "Güncel Batch No");
    const product = str(r, "Ürün");
    const name = str(r, "Makine adı");
    const out = Math.round(num(r, "Bugünkü Çıktı"));
    const tgt = Math.round(num(r, "Günlük Hedef")) || 1;
    productionLines.push({
      id,
      code,
      name,
      product,
      status: "active",
      efficiency: Math.min(100, tgt ? Math.round((100 * out) / tgt) : 0),
      currentBatch: batchNo,
      outputToday: out,
      targetToday: tgt,
      operator: str(r, "Operatör"),
      lastMaintenance: "",
    });
    if (batchNo && !usedBatchNos.has(batchNo)) {
      usedBatchNos.add(batchNo);
      productionBatches.push({
        id: `b-${i + 1}`,
        batchNo,
        product,
        line: name,
        status: "in_progress",
        quantity: out,
        unit: "adet",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        yield: Math.min(100, tgt ? Math.round((100 * out) / tgt) : 0),
        qcScore: 0,
      });
    }
  });

  const ledger: ExcelSeed["ledger"] = [];
  sheetRows(wb, "Yevmiye_Defteri").forEach((r, i) => {
    if (isTemplate(str(r, "İşlem Açıklaması"), str(r, "Belge No"))) return;
    ledger.push({
      id: `led-${i + 1}`,
      date: dateCell(r, "İşlem Tarihi"),
      documentNo: str(r, "Belge No"),
      description: str(r, "İşlem Açıklaması"),
      category: str(r, "Kategori"),
      direction: str(r, "Yön"),
      amount: num(r, "Tutar (₺)"),
      status: str(r, "Durum"),
    });
  });

  const budget: ExcelSeed["budget"] = [];
  sheetRows(wb, "Bütçe").forEach((r, i) => {
    const department = str(r, "Departman");
    if (!department) return;
    budget.push({
      id: `bud-${i + 1}`,
      department,
      annual: num(r, "Yıllık Bütçe (₺)"),
      spent: num(r, "Harcanan (₺)"),
    });
  });

  const personnel: ExcelSeed["personnel"] = [];
  sheetRows(wb, "Personel").forEach((r, i) => {
    const firstName = str(r, "Ad");
    const lastName = str(r, "Soyad");
    if (!firstName && !lastName) return;
    personnel.push({
      id: `p-${i + 1}`,
      firstName,
      lastName,
      department: str(r, "Departman"),
      title: str(r, "Görev"),
      email: str(r, "E-posta"),
      phone: str(r, "Telefon"),
      hireDate: dateCell(r, "İşe Giriş Tarihi"),
      salary: num(r, "Maaş (₺)"),
      iban: str(r, "IBAN"),
    });
  });

  return {
    warehouses,
    rawMaterials: uniqueBy(rawMaterials, (m) => m.sku.toLocaleLowerCase("tr")),
    orders,
    recipes,
    stock,
    rawMaterialOrders,
    productionLines,
    productionBatches: uniqueBy(productionBatches, (b) => b.batchNo),
    customers,
    suppliers,
    personnel,
    products,
    invoices: uniqueBy(invoices, (inv) => inv.invoiceNo),
    invoiceLines,
    ledger,
    budget,
  };
}
