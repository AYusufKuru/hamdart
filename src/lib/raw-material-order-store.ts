import type {
  RawMaterialOrder,
  RawMaterialOrderSource,
} from "@/data/raw-material-orders";
import { seedRawMaterialOrders } from "@/data/raw-material-orders";
import { buildLowStockOrderDrafts } from "@/lib/raw-material-replenishment";
import { WAREHOUSE_IDS } from "@/data/warehouses";
import { readFromStorage, saveToStorage, todayIso } from "@/lib/utils";

const STORAGE_KEY = "hamdart-raw-material-orders";

function readStored(): RawMaterialOrder[] {
  return readFromStorage<RawMaterialOrder>(STORAGE_KEY);
}

function writeStored(orders: RawMaterialOrder[]): void {
  saveToStorage(STORAGE_KEY, orders);
}

function mergeOrders(): RawMaterialOrder[] {
  const stored = readStored();
  const byId = new Map<string, RawMaterialOrder>();
  for (const o of seedRawMaterialOrders) byId.set(o.id, o);
  for (const o of stored) byId.set(o.id, o);
  return Array.from(byId.values());
}

/** Stok uyarılarından eksik sipariş verilecek kayıtlarını ekler */
export function syncReplenishmentOrders(): RawMaterialOrder[] {
  const current = mergeOrders();
  const drafts = buildLowStockOrderDrafts(current);
  if (drafts.length === 0) return current;

  const stored = readStored();
  const newStored = [...stored];
  for (const draft of drafts) {
    if (!current.some((o) => o.id === draft.id)) {
      newStored.push(draft);
    }
  }
  writeStored(newStored);
  return mergeOrders();
}

export function getAllRawMaterialOrders(): RawMaterialOrder[] {
  const list = mergeOrders();
  return list.sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );
}

export function getRawMaterialOrder(id: string): RawMaterialOrder | undefined {
  return getAllRawMaterialOrders().find((o) => o.id === id);
}

export function saveRawMaterialOrder(order: RawMaterialOrder): void {
  const stored = readStored().filter((o) => o.id !== order.id);
  writeStored([...stored, order]);
}

export function createManualRawMaterialOrder(input: {
  materialName: string;
  sku: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source?: RawMaterialOrderSource;
  sourceNote?: string;
  targetWarehouseId?: string;
  orderDate?: string;
  expectedDelivery?: string;
}): RawMaterialOrder {
  const qty = input.quantity;
  const year = new Date().getFullYear();
  const existing = getAllRawMaterialOrders();
  let max = 0;
  for (const o of existing) {
    const match = o.orderNo.match(/HM-(?:AUTO-)?(\d+)-(\d+)/);
    if (match && match[1] === String(year)) {
      max = Math.max(max, parseInt(match[2], 10));
    }
  }
  const order: RawMaterialOrder = {
    id: `rmo-manual-${Date.now()}`,
    orderNo: `HM-${year}-${String(max + 1).padStart(4, "0")}`,
    materialName: input.materialName,
    sku: input.sku,
    supplier: input.supplier,
    quantity: qty,
    unit: input.unit,
    unitPrice: input.unitPrice,
    totalPrice: qty * input.unitPrice,
    status: "to_order",
    source: input.source ?? "manual",
    sourceNote: input.sourceNote,
    targetWarehouseId: input.targetWarehouseId ?? WAREHOUSE_IDS.production,
    orderDate: input.orderDate ?? todayIso(),
    expectedDelivery: input.expectedDelivery,
  };
  saveRawMaterialOrder(order);
  return order;
}
