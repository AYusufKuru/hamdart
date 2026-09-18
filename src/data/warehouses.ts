import type { StockStatus } from "@/data/mock";

export type WarehouseType = "packaging" | "production" | "laboratory" | "finished";

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
  maxStock?: number;
  lotNo: string;
  expiryDate: string;
  status: StockStatus;
  temperature?: string;
  replenishFromWarehouseId?: string;
  labTargetQuantity?: number;
  labDirectEntry?: boolean;
}

export type StockTransferReason =
  | "replenishment"
  | "direct_lab"
  | "manual"
  | "finished_direct"
  | "istanbul_shipment";
export type StockTransferStatus =
  | "pending"
  | "allocated"
  | "approved"
  | "in_transit"
  | "completed";
export type IstanbulShipmentAction = "approve" | "depart" | "arrive";

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  sourceItemId?: string;
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

/** Sabit depo kimlikleri — JSON listesine bağlı değil */
export const WAREHOUSE_IDS = {
  packaging: "wh-ambalaj-deposu-ambalaj",
  production: "wh-fabrika",
  laboratory: "wh-laboratory",
  finishedFactory: "wh-mamul-fabrika",
  finishedInternet: "wh-mamul-internet",
  finishedIstanbul: "wh-mamul-istanbul",
} as const;

export const FINISHED_WAREHOUSE_IDS = [
  WAREHOUSE_IDS.finishedFactory,
  WAREHOUSE_IDS.finishedInternet,
  WAREHOUSE_IDS.finishedIstanbul,
] as const;

const FALLBACK_NAMES: Record<string, string> = {
  "wh-ambalaj-deposu-ambalaj": "Ambalaj Deposu (Ambalaj)",
  "wh-ambalaj-deposu-sise": "Ambalaj Deposu (Şişe)",
  "wh-fabrika": "Fabrika",
  "wh-laboratory": "Laboratuvar Deposu",
  "wh-mamul-fabrika": "Fabrika (Mamul)",
  "wh-mamul-internet": "İnternet satışı",
  "wh-mamul-istanbul": "İstanbul deposu",
};

const nameById = new Map<string, string>(Object.entries(FALLBACK_NAMES));
const warehouseById = new Map<string, Warehouse>();

export function rememberWarehouses(list: Warehouse[]): void {
  nameById.clear();
  warehouseById.clear();
  for (const [id, name] of Object.entries(FALLBACK_NAMES)) {
    nameById.set(id, name);
  }
  for (const warehouse of list) {
    nameById.set(warehouse.id, warehouse.name);
    warehouseById.set(warehouse.id, warehouse);
  }
}

export function getWarehouse(id: string): Warehouse | undefined {
  return warehouseById.get(id);
}

export function getWarehouseName(id: string): string {
  return nameById.get(id) ?? id;
}

export function finishedWarehouseFallbackNames() {
  return FINISHED_WAREHOUSE_IDS.map((id) => getWarehouseName(id));
}

export function occupancyPercent(used: number, capacity: number): number {
  if (!(capacity > 0)) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

export const warehouseTypeLabels: Record<WarehouseType, string> = {
  packaging: "Paketleme",
  production: "Üretim",
  laboratory: "Laboratuvar",
  finished: "Mamul stok",
};

export function isFinishedWarehouseType(type: string) {
  return type === "finished";
}

export function isFinishedWarehouseId(id: string) {
  return (FINISHED_WAREHOUSE_IDS as readonly string[]).includes(id);
}

export function isIstanbulWarehouseId(id: string) {
  return id === WAREHOUSE_IDS.finishedIstanbul;
}

export function needsIstanbulShipment(toWarehouseId: string) {
  return isIstanbulWarehouseId(toWarehouseId);
}

export const ISTANBUL_SHIPMENT_STATUS_LABEL: Record<string, string> = {
  allocated: "Stok ayrıldı",
  approved: "Sevkiyat onaylandı",
  in_transit: "Yolda",
  completed: "İstanbul deposunda",
  pending: "Bekliyor",
};

export const ISTANBUL_SHIPMENT_NEXT: Record<
  string,
  { action: IstanbulShipmentAction; label: string } | null
> = {
  allocated: { action: "approve", label: "Sevkiyatı onayla" },
  approved: { action: "depart", label: "Yola çıktı" },
  in_transit: { action: "arrive", label: "İstanbul'a geldi" },
  completed: null,
  pending: null,
};

export function transferReasonLabel(reason: string) {
  if (reason === "replenishment") return "Ana depodan aktarım";
  if (reason === "direct_lab") return "Doğrudan lab girişi";
  if (reason === "finished_direct") return "Mamul aktarım";
  if (reason === "istanbul_shipment") return "İstanbul sevkiyatı";
  return "Manuel";
}

export function transferStatusLabel(status: string) {
  return ISTANBUL_SHIPMENT_STATUS_LABEL[status] ?? (status === "completed" ? "Tamamlandı" : "Bekliyor");
}

export function allowedTransferDestinations(
  source: Warehouse | undefined,
  warehouses: Warehouse[]
) {
  if (!source) return warehouses;
  const sourceFinished = isFinishedWarehouseType(source.type);
  return warehouses.filter((w) => {
    if (w.id === source.id) return false;
    return isFinishedWarehouseType(w.type) === sourceFinished;
  });
}
