import type { StockStatus } from "@/data/mock";
import { generateExtendedWarehouseStock } from "@/lib/warehouse-stock-generator";

export type WarehouseType = "packaging" | "production" | "laboratory";

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  description: string;
  location: string;
  capacity: number;
  used: number;
  temperature: string;
  humidity: string;
  manager: string;
  items: number;
  lastAudit: string;
}

export interface WarehouseStockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouseId: string;
  quantity: number;
  unit: string;
  minStock: number;
  lotNo: string;
  expiryDate: string;
  status: StockStatus;
  temperature?: string;
  /** Laboratuvar: ana depodan (üretim malzemeleri) aktarım kaynağı */
  replenishFromWarehouseId?: string;
  /** Lab hedef stok — altına düşünce aktarım önerilir */
  labTargetQuantity?: number;
  /** Değerli/az miktar — doğrudan laboratuvara giriş */
  labDirectEntry?: boolean;
}

export type StockTransferReason = "replenishment" | "direct_lab" | "manual";
export type StockTransferStatus = "pending" | "completed";

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  materialName: string;
  sku: string;
  quantity: number;
  unit: string;
  reason: StockTransferReason;
  status: StockTransferStatus;
  createdAt: string;
  completedAt?: string;
  note?: string;
}

export const WAREHOUSE_IDS = {
  packaging: "wh-packaging",
  production: "wh-production",
  laboratory: "wh-laboratory",
} as const;

export const warehouses: Warehouse[] = [
  {
    id: WAREHOUSE_IDS.packaging,
    name: "Paketleme Deposu",
    type: "packaging",
    description:
      "Kutu, şişe, kapak, etiket ve ambalaj malzemeleri. Mamul sevkiyat öncesi paketleme stoku.",
    location: "İstanbul — Gebze OSB / B Blok",
    capacity: 8000,
    used: 5200,
    temperature: "18-25°C",
    humidity: "45-55%",
    manager: "Can Öztürk",
    items: 186,
    lastAudit: "2026-05-18",
  },
  {
    id: WAREHOUSE_IDS.production,
    name: "Üretim Malzemeleri Deposu",
    type: "production",
    description:
      "Ana depo: API, eksipiyan ve üretim hammadde stokları. Laboratuvar deposuna buradan aktarım yapılır.",
    location: "İstanbul — Gebze OSB / A Blok",
    capacity: 20000,
    used: 15400,
    temperature: "15-25°C",
    humidity: "≤50%",
    manager: "Fatma Koç",
    items: 412,
    lastAudit: "2026-05-20",
  },
  {
    id: WAREHOUSE_IDS.laboratory,
    name: "Laboratuvar Deposu",
    type: "laboratory",
    description:
      "Ar-Ge ve kalite kontrol için sınırlı miktarlar. Çoğu ürün üretim deposundan aktarılır; değerli ve az miktarlı maddeler doğrudan buraya giriş yapar.",
    location: "İstanbul — Gebze OSB / Ar-Ge Katı",
    capacity: 500,
    used: 318,
    temperature: "18-22°C",
    humidity: "40-50%",
    manager: "Dr. Selin Aktaş",
    items: 94,
    lastAudit: "2026-05-22",
  },
];

const coreWarehouseStockItems: WarehouseStockItem[] = [
  // —— Paketleme ——
  {
    id: "ws-p1",
    sku: "PKG-BOX-10",
    name: "Karton Kutu (10'lu)",
    category: "Ambalaj",
    warehouseId: WAREHOUSE_IDS.packaging,
    quantity: 48500,
    unit: "adet",
    minStock: 20000,
    lotNo: "PKG-2026-0412",
    expiryDate: "2028-12-31",
    status: "normal",
  },
  {
    id: "ws-p2",
    sku: "PKG-BTL-100",
    name: "Şurup Şişesi 100ml",
    category: "Ambalaj",
    warehouseId: WAREHOUSE_IDS.packaging,
    quantity: 12000,
    unit: "adet",
    minStock: 8000,
    lotNo: "PKG-2026-0398",
    expiryDate: "2029-06-30",
    status: "normal",
  },
  {
    id: "ws-p3",
    sku: "PKG-CAP-28",
    name: "Plastik Kapak Ø28mm",
    category: "Ambalaj",
    warehouseId: WAREHOUSE_IDS.packaging,
    quantity: 3200,
    unit: "adet",
    minStock: 10000,
    lotNo: "PKG-2026-0401",
    expiryDate: "2029-01-15",
    status: "low",
  },
  {
    id: "ws-p4",
    sku: "PKG-LBL-CM",
    name: "CardioMax Etiket Rulosu",
    category: "Etiket",
    warehouseId: WAREHOUSE_IDS.packaging,
    quantity: 850000,
    unit: "adet",
    minStock: 200000,
    lotNo: "LBL-2026-0089",
    expiryDate: "2027-08-01",
    status: "normal",
  },
  {
    id: "ws-p5",
    sku: "PKG-FOIL-AL",
    name: "Alüminyum Folyo (blister)",
    category: "Ambalaj",
    warehouseId: WAREHOUSE_IDS.packaging,
    quantity: 1800,
    unit: "kg",
    minStock: 2500,
    lotNo: "PKG-2026-0377",
    expiryDate: "2028-03-20",
    status: "critical",
  },

  // —— Üretim malzemeleri (ana depo) ——
  {
    id: "ws-m1",
    sku: "RM-API-CM",
    name: "CardioMax API",
    category: "Ham Madde",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 450,
    unit: "kg",
    minStock: 200,
    lotNo: "API-2026-0156",
    expiryDate: "2027-09-01",
    status: "normal",
  },
  {
    id: "ws-m2",
    sku: "RM-EXC-MCC",
    name: "Mikrokristalin Selüloz",
    category: "Eksipiyan",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 2800,
    unit: "kg",
    minStock: 1500,
    lotNo: "EXC-2026-0089",
    expiryDate: "2029-12-31",
    status: "normal",
  },
  {
    id: "ws-m3",
    sku: "RM-API-NR",
    name: "NeuroRelief API",
    category: "Ham Madde",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 180,
    unit: "kg",
    minStock: 120,
    lotNo: "API-2026-0142",
    expiryDate: "2027-11-20",
    status: "normal",
  },
  {
    id: "ws-m4",
    sku: "RM-EXC-PVP",
    name: "Povidon K30",
    category: "Eksipiyan",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 620,
    unit: "kg",
    minStock: 400,
    lotNo: "EXC-2026-0095",
    expiryDate: "2028-06-15",
    status: "normal",
  },
  {
    id: "ws-m5",
    sku: "RM-API-IB",
    name: "ImmunoBoost Aktif",
    category: "Ham Madde",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 95,
    unit: "kg",
    minStock: 80,
    lotNo: "API-2026-0161",
    expiryDate: "2027-06-10",
    status: "low",
  },
  {
    id: "ws-m6",
    sku: "PHM-CM-50",
    name: "CardioMax 50mg Tablet (mamul)",
    category: "Mamul",
    warehouseId: WAREHOUSE_IDS.production,
    quantity: 2450000,
    unit: "tablet",
    minStock: 500000,
    lotNo: "LOT-2026-0845",
    expiryDate: "2028-03-15",
    status: "normal",
  },

  // —— Laboratuvar (aktarım + doğrudan giriş) ——
  {
    id: "ws-l1",
    sku: "RM-API-CM",
    name: "CardioMax API (lab numune)",
    category: "Ham Madde",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 0.8,
    unit: "kg",
    minStock: 0.5,
    labTargetQuantity: 2,
    replenishFromWarehouseId: WAREHOUSE_IDS.production,
    lotNo: "API-2026-0156-L",
    expiryDate: "2027-09-01",
    status: "low",
  },
  {
    id: "ws-l2",
    sku: "RM-EXC-MCC",
    name: "Mikrokristalin Selüloz (lab)",
    category: "Eksipiyan",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 4.2,
    unit: "kg",
    minStock: 2,
    labTargetQuantity: 10,
    replenishFromWarehouseId: WAREHOUSE_IDS.production,
    lotNo: "EXC-2026-0089-L",
    expiryDate: "2029-12-31",
    status: "normal",
  },
  {
    id: "ws-l3",
    sku: "RM-API-NR",
    name: "NeuroRelief API (lab numune)",
    category: "Ham Madde",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 0.35,
    unit: "kg",
    minStock: 0.25,
    labTargetQuantity: 1,
    replenishFromWarehouseId: WAREHOUSE_IDS.production,
    lotNo: "API-2026-0142-L",
    expiryDate: "2027-11-20",
    status: "normal",
  },
  {
    id: "ws-l4",
    sku: "REF-STD-GLD",
    name: "Altın Standart Referans (CardioMax)",
    category: "Referans Standart",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 0.012,
    unit: "g",
    minStock: 0.01,
    labDirectEntry: true,
    lotNo: "REF-2026-0003",
    expiryDate: "2027-12-31",
    status: "normal",
  },
  {
    id: "ws-l5",
    sku: "REF-STD-NR-RARE",
    name: "NeuroRelief İzotop Etiketli Referans",
    category: "Referans Standart",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 0.005,
    unit: "g",
    minStock: 0.003,
    labDirectEntry: true,
    lotNo: "REF-2026-0007",
    expiryDate: "2026-11-30",
    status: "expiring",
    temperature: "2-8°C",
  },
  {
    id: "ws-l6",
    sku: "PHM-CM-50",
    name: "CardioMax Tablet (stabilite numunesi)",
    category: "Numune",
    warehouseId: WAREHOUSE_IDS.laboratory,
    quantity: 1200,
    unit: "tablet",
    minStock: 500,
    labTargetQuantity: 5000,
    replenishFromWarehouseId: WAREHOUSE_IDS.production,
    lotNo: "LOT-2026-0845-L",
    expiryDate: "2028-03-15",
    status: "normal",
  },
];

export const warehouseStockItems: WarehouseStockItem[] = [
  ...coreWarehouseStockItems,
  ...generateExtendedWarehouseStock(),
];

export function getCategoriesForWarehouse(warehouseId: string): string[] {
  const cats = new Set(
    getStockByWarehouse(warehouseId).map((i) => i.category)
  );
  return Array.from(cats).sort();
}

export function getTransfersForWarehouse(warehouseId: string): StockTransfer[] {
  return stockTransfers.filter(
    (t) =>
      t.fromWarehouseId === warehouseId || t.toWarehouseId === warehouseId
  );
}

export const stockTransfers: StockTransfer[] = [
  {
    id: "tr-1",
    fromWarehouseId: WAREHOUSE_IDS.production,
    toWarehouseId: WAREHOUSE_IDS.laboratory,
    materialName: "CardioMax API (lab numune)",
    sku: "RM-API-CM",
    quantity: 1.2,
    unit: "kg",
    reason: "replenishment",
    status: "pending",
    createdAt: "2026-05-23T09:15:00",
    note: "Lab stoğu hedefin altında (0.8 / 2 kg)",
  },
  {
    id: "tr-2",
    fromWarehouseId: WAREHOUSE_IDS.production,
    toWarehouseId: WAREHOUSE_IDS.laboratory,
    materialName: "CardioMax Tablet (stabilite numunesi)",
    sku: "PHM-CM-50",
    quantity: 3800,
    unit: "tablet",
    reason: "replenishment",
    status: "pending",
    createdAt: "2026-05-23T08:40:00",
    note: "Stabilite çalışması için numune tamamlama",
  },
  {
    id: "tr-3",
    fromWarehouseId: WAREHOUSE_IDS.production,
    toWarehouseId: WAREHOUSE_IDS.laboratory,
    materialName: "NeuroRelief API (lab numune)",
    sku: "RM-API-NR",
    quantity: 0.65,
    unit: "kg",
    reason: "replenishment",
    status: "completed",
    createdAt: "2026-05-22T14:20:00",
    completedAt: "2026-05-22T15:05:00",
  },
  {
    id: "tr-4",
    fromWarehouseId: WAREHOUSE_IDS.production,
    toWarehouseId: WAREHOUSE_IDS.laboratory,
    materialName: "Altın Standart Referans (CardioMax)",
    sku: "REF-STD-GLD",
    quantity: 0.012,
    unit: "g",
    reason: "direct_lab",
    status: "completed",
    createdAt: "2026-05-20T11:00:00",
    completedAt: "2026-05-20T11:00:00",
    note: "Değerli referans — doğrudan laboratuvar girişi",
  },
];

export function getWarehouse(id: string): Warehouse | undefined {
  return warehouses.find((w) => w.id === id);
}

export function getWarehouseName(id: string): string {
  return getWarehouse(id)?.name ?? id;
}

export function getStockByWarehouse(warehouseId: string): WarehouseStockItem[] {
  return warehouseStockItems.filter((i) => i.warehouseId === warehouseId);
}

export function getLabItemsNeedingReplenishment(): WarehouseStockItem[] {
  return warehouseStockItems.filter(
    (i) =>
      i.warehouseId === WAREHOUSE_IDS.laboratory &&
      !i.labDirectEntry &&
      i.replenishFromWarehouseId &&
      i.labTargetQuantity !== undefined &&
      i.quantity < i.minStock
  );
}

export const warehouseTypeLabels: Record<WarehouseType, string> = {
  packaging: "Paketleme",
  production: "Üretim Malzemeleri",
  laboratory: "Laboratuvar",
};
