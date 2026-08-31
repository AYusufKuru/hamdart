import { orders as seedOrders, type Order, type OrderStatus } from "@/data/mock";
import { readFromStorage, saveToStorage } from "@/lib/utils";

const STORAGE_KEY = "hamdart-orders";

function readStored(): Order[] {
  return readFromStorage<Order>(STORAGE_KEY);
}

function writeStored(list: Order[]): void {
  saveToStorage(STORAGE_KEY, list);
}

export function getAllOrders(): Order[] {
  const stored = readStored();
  const byId = new Map<string, Order>();
  for (const o of seedOrders) byId.set(o.id, o);
  for (const o of stored) byId.set(o.id, o);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );
}

export function getOrder(id: string): Order | undefined {
  return getAllOrders().find((o) => o.id === id);
}

function nextOrderNo(existing: Order[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const o of existing) {
    const match = o.orderNo.match(/SIP-\d+-(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `SIP-${year}-${String(max + 1).padStart(4, "0")}`;
}

export type CreateOrderInput = {
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  status: OrderStatus;
  orderDate: string;
  deliveryDate: string;
  priority: Order["priority"];
  warehouse: string;
  value: number;
};

export function createOrder(input: CreateOrderInput): Order {
  const all = getAllOrders();
  const order: Order = {
    id: `o-${Date.now()}`,
    orderNo: nextOrderNo(all),
    ...input,
  };
  const stored = readStored().filter((o) => o.id !== order.id);
  writeStored([order, ...stored]);
  return order;
}

export function getOrderCustomers(): string[] {
  return [...new Set(getAllOrders().map((o) => o.customer))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export function getOrderProducts(): string[] {
  return [...new Set(getAllOrders().map((o) => o.product))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}
