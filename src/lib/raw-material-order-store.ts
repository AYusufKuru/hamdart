import type {
  RawMaterialOrder,
  RawMaterialOrderSource,
} from "@/data/raw-material-orders";
import { seedRawMaterialOrders } from "@/data/raw-material-orders";
import { buildLowStockOrderDrafts } from "@/lib/raw-material-replenishment";
import { WAREHOUSE_IDS } from "@/data/warehouses";

const STORAGE_KEY = "hamdart-raw-material-orders";

function readStored(): RawMaterialOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RawMaterialOrder[];
  } catch {
    return [];
  }
}

function writeStored(orders: RawMaterialOrder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
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
}): RawMaterialOrder {
  const qty = input.quantity;
  const order: RawMaterialOrder = {
    id: `rmo-manual-${Date.now()}`,
    orderNo: `HM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
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
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: new Date().toISOString().slice(0, 10),
  };
  saveRawMaterialOrder(order);
  return order;
}
