import type {
  RawMaterialOrder,
  RawMaterialOrderSource,
} from "@/data/raw-material-orders";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import type { RawMaterialOrderAction } from "@/lib/raw-material-order-flow";

export async function syncReplenishmentOrders(): Promise<RawMaterialOrder[]> {
  return apiPatch<RawMaterialOrder[]>("/api/raw-material-orders", {});
}

export async function getAllRawMaterialOrders(): Promise<RawMaterialOrder[]> {
  return apiGet<RawMaterialOrder[]>("/api/raw-material-orders");
}

export async function getRawMaterialOrder(
  id: string
): Promise<RawMaterialOrder | undefined> {
  try {
    return await apiGet<RawMaterialOrder>(`/api/raw-material-orders/${id}`);
  } catch {
    return undefined;
  }
}

export async function saveRawMaterialOrder(
  order: RawMaterialOrder
): Promise<RawMaterialOrder> {
  return apiPut<RawMaterialOrder>("/api/raw-material-orders", order);
}

export async function createManualRawMaterialOrder(input: {
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
}): Promise<RawMaterialOrder> {
  return apiPost<RawMaterialOrder>("/api/raw-material-orders", input);
}

export async function applyRawMaterialOrderActionApi(
  orderId: string,
  action: RawMaterialOrderAction
): Promise<RawMaterialOrder> {
  return apiPost<RawMaterialOrder>(
    `/api/raw-material-orders/${orderId}/actions`,
    { action }
  );
}
