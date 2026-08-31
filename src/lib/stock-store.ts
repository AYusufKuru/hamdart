import type { StockItem, StockStatus } from "@/data/mock";
import { parseLocalDate, readFromStorage, saveToStorage } from "@/lib/utils";
import {
  getWarehouseName,
  warehouseStockItems as seedStock,
  WAREHOUSE_IDS,
  type WarehouseStockItem,
} from "@/data/warehouses";

const STORAGE_KEY = "hamdart-warehouse-stock";

export const STOCK_CATEGORIES = [
  "Ham Madde",
  "Eksipiyan",
  "Ambalaj",
  "Etiket",
  "Mamul",
  "Numune",
  "Referans Standart",
] as const;

export const STOCK_UNITS = [
  "kg",
  "g",
  "mL",
  "L",
  "adet",
  "tablet",
  "kapsül",
  "şişe",
  "kalem",
  "rulo",
] as const;

function readStored(): WarehouseStockItem[] {
  return readFromStorage<WarehouseStockItem>(STORAGE_KEY);
}

function writeStored(list: WarehouseStockItem[]): void {
  saveToStorage(STORAGE_KEY, list);
}

export function getAllWarehouseStockItems(): WarehouseStockItem[] {
  const stored = readStored();
  const byId = new Map<string, WarehouseStockItem>();
  for (const item of seedStock) byId.set(item.id, item);
  for (const item of stored) byId.set(item.id, item);
  return Array.from(byId.values());
}

export function getStockItemsForWarehouse(
  warehouseId: string
): WarehouseStockItem[] {
  return getAllWarehouseStockItems().filter(
    (i) => i.warehouseId === warehouseId
  );
}

export function getStockCategoriesForWarehouse(warehouseId: string): string[] {
  return [
    ...new Set(getStockItemsForWarehouse(warehouseId).map((i) => i.category)),
  ].sort((a, b) => a.localeCompare(b, "tr"));
}

export function getLabItemsNeedingReplenishmentFromStore(): WarehouseStockItem[] {
  return getAllWarehouseStockItems().filter(
    (i) =>
      i.warehouseId === WAREHOUSE_IDS.laboratory &&
      !i.labDirectEntry &&
      i.replenishFromWarehouseId &&
      i.labTargetQuantity !== undefined &&
      i.quantity < i.minStock
  );
}

export function toDisplayStockItems(
  items: WarehouseStockItem[] = getAllWarehouseStockItems()
): StockItem[] {
  return items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    minStock: item.minStock,
    warehouse: getWarehouseName(item.warehouseId),
    warehouseId: item.warehouseId,
    lotNo: item.lotNo,
    expiryDate: item.expiryDate,
    status: item.status,
    temperature: item.temperature,
    labDirectEntry: item.labDirectEntry,
    replenishFromWarehouseId: item.replenishFromWarehouseId,
    labTargetQuantity: item.labTargetQuantity,
  }));
}

export function deriveStockStatus(
  quantity: number,
  minStock: number,
  expiryDate: string
): StockStatus {
  if (quantity <= 0 || (minStock > 0 && quantity < minStock * 0.5)) {
    return "critical";
  }
  if (minStock > 0 && quantity < minStock) return "low";
  if (expiryDate) {
    const days =
      (parseLocalDate(expiryDate).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    if (days <= 180) return "expiring";
  }
  return "normal";
}

export type CreateStockInput = {
  sku: string;
  name: string;
  category: string;
  warehouseId: string;
  quantity: number;
  unit: string;
  minStock: number;
  lotNo: string;
  expiryDate: string;
  status?: StockStatus;
  temperature?: string;
  labDirectEntry?: boolean;
  replenishFromWarehouseId?: string;
  labTargetQuantity?: number;
};

export function createStockEntry(input: CreateStockInput): WarehouseStockItem {
  const item: WarehouseStockItem = {
    id: `ws-manual-${Date.now()}`,
    sku: input.sku.trim(),
    name: input.name.trim(),
    category: input.category,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    unit: input.unit,
    minStock: input.minStock,
    lotNo: input.lotNo.trim(),
    expiryDate: input.expiryDate,
    status:
      input.status ??
      deriveStockStatus(input.quantity, input.minStock, input.expiryDate),
    temperature: input.temperature?.trim() || undefined,
    labDirectEntry: input.labDirectEntry || undefined,
    replenishFromWarehouseId: input.replenishFromWarehouseId,
    labTargetQuantity: input.labTargetQuantity,
  };
  const stored = readStored().filter((i) => i.id !== item.id);
  writeStored([item, ...stored]);
  return item;
}

export function getKnownSkus(): string[] {
  return [...new Set(getAllWarehouseStockItems().map((i) => i.sku))].sort();
}

export function getKnownStockNames(): string[] {
  return [...new Set(getAllWarehouseStockItems().map((i) => i.name))].sort(
    (a, b) => a.localeCompare(b, "tr")
  );
}

export function getKnownCategories(): string[] {
  const fromData = getAllWarehouseStockItems().map((i) => i.category);
  return [...new Set([...STOCK_CATEGORIES, ...fromData])].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export function getKnownUnits(): string[] {
  const fromData = getAllWarehouseStockItems().map((i) => i.unit);
  return [...new Set([...STOCK_UNITS, ...fromData])];
}
