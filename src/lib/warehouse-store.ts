import type { IstanbulShipmentAction, StockTransfer, Warehouse } from "@/data/warehouses";
import { rememberWarehouses } from "@/data/warehouses";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

export async function getWarehouses(): Promise<Warehouse[]> {
  const list = await apiGet<Warehouse[]>("/api/catalog/warehouses");
  rememberWarehouses(list);
  return list;
}

export async function getStockTransfers(): Promise<StockTransfer[]> {
  return apiGet<StockTransfer[]>("/api/stock/transfers");
}

export type CreateStockTransferInput = {
  sourceItemId: string;
  toWarehouseId: string;
  quantity: number;
  reason: StockTransfer["reason"];
  note?: string;
};

export async function createStockTransfer(
  input: CreateStockTransferInput
): Promise<StockTransfer> {
  return apiPost<StockTransfer>("/api/stock/transfers", input);
}

export async function getTransferRequestOptions(
  warehouseId: string
): Promise<{ sku: string; name: string; unit: string }[]> {
  return apiGet(`/api/stock/transfer-requests?warehouseId=${encodeURIComponent(warehouseId)}`);
}

export async function createTransferRequest(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  sku: string;
  quantity: number;
  note?: string;
}): Promise<StockTransfer> {
  return apiPost<StockTransfer>("/api/stock/transfer-requests", input);
}

export async function respondTransferRequest(
  id: string,
  input: { action: "approve" | "reject"; sourceItemId?: string; note?: string }
): Promise<StockTransfer> {
  return apiPatch<StockTransfer>(`/api/stock/transfer-requests/${id}`, input);
}

export async function advanceStockTransfer(
  id: string,
  action: IstanbulShipmentAction
): Promise<StockTransfer> {
  return apiPatch<StockTransfer>(`/api/stock/transfers/${id}`, { action });
}
