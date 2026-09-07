import type { Order } from "@/data/mock";
import { apiGet, apiPost } from "@/lib/api-client";

export type CreateOrderInput = {
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  status: Order["status"];
  orderDate: string;
  deliveryDate: string;
  priority: Order["priority"];
  warehouse: string;
  value: number;
};

export async function getAllOrders(): Promise<Order[]> {
  return apiGet<Order[]>("/api/orders");
}

export async function getOrder(id: string): Promise<Order | undefined> {
  try {
    return await apiGet<Order>(`/api/orders/${id}`);
  } catch {
    return undefined;
  }
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiPost<Order>("/api/orders", input);
}

export async function getOrderCustomers(): Promise<string[]> {
  const orders = await getAllOrders();
  return [...new Set(orders.map((o) => o.customer))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getOrderProducts(): Promise<string[]> {
  const orders = await getAllOrders();
  return [...new Set(orders.map((o) => o.product))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}
