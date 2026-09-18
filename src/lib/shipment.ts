import type { Order } from "@/data/mock";

export const PRODUCTION_SHIPMENT_CUSTOMER = "Üretim çıkışı";

export function isUnsetShipmentCustomer(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  return !value || value === PRODUCTION_SHIPMENT_CUSTOMER;
}

export function isReadyToShip(status: Order["status"]) {
  return status === "pending" || status === "confirmed" || status === "picking";
}

export function readyShipmentLabel(order: Pick<Order, "orderNo" | "customer" | "product" | "batchNo">) {
  const party = isUnsetShipmentCustomer(order.customer)
    ? "Müşteri atanmadı"
    : order.customer;
  const batch = order.batchNo?.trim() ? ` · ${order.batchNo.trim()}` : "";
  const product = order.product?.trim() ? ` · ${order.product.trim()}` : "";
  return `${order.orderNo}${batch} · ${party}${product}`;
}

export function parseQuantityLabel(label: string): number {
  const match = String(label ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}
