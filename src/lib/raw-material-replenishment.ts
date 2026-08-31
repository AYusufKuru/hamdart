import type { RawMaterialOrder } from "@/data/raw-material-orders";
import { WAREHOUSE_IDS } from "@/data/warehouses";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { todayIso } from "@/lib/utils";

const OPEN_STATUSES = new Set([
  "to_order",
  "ordered",
  "received",
  "qc_pending",
]);

/** Üretim deposunda min. stok altı — otomatik sipariş verilecek adayı */
export function buildLowStockOrderDrafts(
  existingOrders: RawMaterialOrder[]
): RawMaterialOrder[] {
  const openSkus = new Set(
    existingOrders
      .filter((o) => OPEN_STATUSES.has(o.status))
      .map((o) => o.sku)
  );

  const drafts: RawMaterialOrder[] = [];
  const today = todayIso();

  for (const item of getAllWarehouseStockItems()) {
    if (item.warehouseId !== WAREHOUSE_IDS.production) continue;
    const belowMin = item.minStock > 0 && item.quantity < item.minStock;
    const alertStatus = item.status === "low" || item.status === "critical";
    if (!belowMin && !alertStatus) continue;
    if (openSkus.has(item.sku)) continue;

    const unitCost =
      getAllRawMaterials().find((r) => r.sku === item.sku)?.unitCost ?? 1000;
    const orderQty = Math.max(item.minStock - item.quantity, item.minStock * 0.5);

    drafts.push({
      id: `rmo-auto-${item.sku}`,
      orderNo: `HM-AUTO-${item.sku.slice(-4)}`,
      materialName: item.name,
      sku: item.sku,
      supplier: "— Tedarikçi atanacak",
      quantity: Math.ceil(orderQty),
      unit: item.unit,
      unitPrice: unitCost,
      totalPrice: Math.ceil(orderQty) * unitCost,
      status: "to_order",
      source: "low_stock",
      sourceNote: `Üretim deposu: ${item.quantity} ${item.unit} (min: ${item.minStock})`,
      targetWarehouseId: WAREHOUSE_IDS.production,
      orderDate: today,
    });
    openSkus.add(item.sku);
  }

  return drafts;
}
