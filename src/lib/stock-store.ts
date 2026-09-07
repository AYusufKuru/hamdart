import type { StockItem, StockStatus } from "@/data/mock";
import { getWarehouseName, type WarehouseStockItem } from "@/data/warehouses";
import { apiGet, apiPost } from "@/lib/api-client";
import { getWarehouses } from "@/lib/warehouse-store";
import { parseLocalDate } from "@/lib/utils";

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

export async function getAllWarehouseStockItems(): Promise<WarehouseStockItem[]> {
  const [items] = await Promise.all([
    apiGet<WarehouseStockItem[]>("/api/stock"),
    getWarehouses().catch(() => []),
  ]);
  return items;
}

export async function getStockItemsForWarehouse(
  warehouseId: string
): Promise<WarehouseStockItem[]> {
  const all = await getAllWarehouseStockItems();
  return all.filter((i) => i.warehouseId === warehouseId);
}

export async function getStockCategoriesForWarehouse(
  warehouseId: string
): Promise<string[]> {
  const items = await getStockItemsForWarehouse(warehouseId);
  return [...new Set(items.map((i) => i.category))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getLabItemsNeedingReplenishmentFromStore(): Promise<
  WarehouseStockItem[]
> {
  const { WAREHOUSE_IDS } = await import("@/data/warehouses");
  const all = await getAllWarehouseStockItems();
  return all.filter(
    (i) =>
      i.warehouseId === WAREHOUSE_IDS.laboratory &&
      !i.labDirectEntry &&
      i.replenishFromWarehouseId &&
      i.labTargetQuantity !== undefined &&
      i.quantity < i.minStock
  );
}

export function toDisplayStockItems(items: WarehouseStockItem[]): StockItem[] {
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

export async function createStockEntry(
  input: CreateStockInput
): Promise<WarehouseStockItem> {
  return apiPost<WarehouseStockItem>("/api/stock", input);
}

export async function getKnownSkus(): Promise<string[]> {
  const all = await getAllWarehouseStockItems();
  return [...new Set(all.map((i) => i.sku))].sort();
}

export async function getKnownStockNames(): Promise<string[]> {
  const all = await getAllWarehouseStockItems();
  return [...new Set(all.map((i) => i.name))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getKnownCategories(): Promise<string[]> {
  const all = await getAllWarehouseStockItems();
  const fromData = all.map((i) => i.category);
  return [...new Set([...STOCK_CATEGORIES, ...fromData])].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getKnownUnits(): Promise<string[]> {
  const all = await getAllWarehouseStockItems();
  const fromData = all.map((i) => i.unit);
  return [...new Set([...STOCK_UNITS, ...fromData])];
}
