import type { StockStatus } from "@/data/mock";

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
  maxStock?: number;
  lotNo: string;
  expiryDate: string;
  status: StockStatus;
  temperature?: string;
  replenishFromWarehouseId?: string;
  labTargetQuantity?: number;
  labDirectEntry?: boolean;
}

export type StockTransferReason = "replenishment" | "direct_lab" | "manual";
export type StockTransferStatus = "pending" | "completed";

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
} as const;

const FALLBACK_NAMES: Record<string, string> = {
  "wh-ambalaj-deposu-ambalaj": "Ambalaj Deposu (Ambalaj)",
  "wh-ambalaj-deposu-sise": "Ambalaj Deposu (Şişe)",
  "wh-fabrika": "Fabrika",
  "wh-laboratory": "Laboratuvar Deposu",
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

export function occupancyPercent(used: number, capacity: number): number {
  if (!(capacity > 0)) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

export const warehouseTypeLabels: Record<WarehouseType, string> = {
  packaging: "Paketleme",
  production: "Üretim",
  laboratory: "Laboratuvar",
};
