import type { Prisma } from "@prisma/client";
import type { BatchMaterialUsage, Order, OrderStatus, ProductionBatch, ProductionLine, ProductionLineStatus, LabExperiment, LabExperimentMaterialUsage, LabSample } from "@/data/mock";
import type { Recipe, RecipeExtra, RecipeLine } from "@/data/recipes";
import type { RawMaterialOrder, RawMaterialOrderSource, RawMaterialOrderStatus } from "@/data/raw-material-orders";
import type { RawMaterial } from "@/data/raw-materials";
import type { WarehouseStockItem } from "@/data/warehouses";
import type {
  Customer,
  Supplier,
  Personnel,
  FinishedProduct,
  Invoice,
  InvoiceLine,
  DeliveryNote,
  DeliveryNoteLine,
  LedgerEntry,
  BudgetRow,
} from "@/data/catalog";
import type { StockTransfer, Warehouse } from "@/data/warehouses";
import {
  WAREHOUSE_IDS,
  getWarehouseName,
  isFinishedWarehouseType,
  ISTANBUL_SHIPMENT_NEXT,
  needsIstanbulShipment,
} from "@/data/warehouses";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { plusYearsIso, todayIso, parseLocalDate, selectItemValues, plusDaysIso } from "@/lib/utils";
import { personnelDisplayName, matchesLabPersonnelDepartment, type LabPersonRole } from "@/lib/personnel";
import { toCustomer, toSupplier, toInvoice, toInvoiceLine, toDeliveryNote } from "@/lib/server/catalog-write";
import type { CreateRecipeInput } from "@/lib/recipe-store";
import type { CreateRawMaterialInput } from "@/lib/raw-material-store";
import type { CreateStockInput } from "@/lib/stock-store";
import type { CreateBatchInput } from "@/lib/production-store";
import {
  estimateRecipeMaterials,
  findRecipeByProductName,
  matchNameKey,
} from "@/lib/recipe-calculations";
import {
  isUnsetShipmentCustomer,
  parseQuantityLabel,
  PRODUCTION_SHIPMENT_CUSTOMER,
} from "@/lib/shipment";
import type { CreateExperimentInput, CreateSampleInput } from "@/lib/lab-store";
import type { RawMaterialOrderAction } from "@/lib/raw-material-order-flow";
import {
  FieldError,
  asEnum,
  asFiniteNumber,
  asIsoDate,
  asRecord,
  asString,
} from "@/lib/server/fields";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Prisma Decimal / string / number → sonlu JS sayısı */
function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseRecipeLines(json: string): RecipeLine[] {
  try {
    return JSON.parse(json) as RecipeLine[];
  } catch {
    return [];
  }
}

function parseRecipeExtras(json: string): RecipeExtra[] {
  try {
    return JSON.parse(json) as RecipeExtra[];
  } catch {
    return [];
  }
}

function toRecipe(row: {
  id: string;
  code: string | null;
  productCode: string | null;
  orderId: string;
  productName: string;
  createdAt: string;
  createdBy: string;
  lines: string;
  extras: string;
  status: string;
}): Recipe {
  return {
    id: row.id,
    code: row.code ?? undefined,
    productCode: row.productCode ?? undefined,
    orderId: row.orderId,
    productName: row.productName,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    lines: parseRecipeLines(row.lines),
    extras: parseRecipeExtras(row.extras),
    status: row.status as Recipe["status"],
  };
}

function toStockItem(row: {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouseId: string;
  quantity: number;
  unit: string;
  minStock: number;
  maxStock: number | null;
  lotNo: string;
  expiryDate: string;
  status: string;
  temperature: string | null;
  replenishFromWarehouseId: string | null;
  labTargetQuantity: number | null;
  labDirectEntry: boolean;
}): WarehouseStockItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    warehouseId: row.warehouseId,
    quantity: row.quantity,
    unit: row.unit,
    minStock: row.minStock,
    maxStock: row.maxStock ?? undefined,
    lotNo: row.lotNo,
    expiryDate: row.expiryDate,
    status: row.status as WarehouseStockItem["status"],
    temperature: row.temperature ?? undefined,
    replenishFromWarehouseId: row.replenishFromWarehouseId ?? undefined,
    labTargetQuantity: row.labTargetQuantity ?? undefined,
    labDirectEntry: row.labDirectEntry || undefined,
  };
}

function toRmo(row: {
  id: string;
  orderNo: string;
  materialName: string;
  sku: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitPrice: unknown;
  totalPrice: unknown;
  status: string;
  source: string;
  sourceNote: string | null;
  targetWarehouseId: string;
  orderDate: string;
  expectedDelivery: string | null;
  receivedDate: string | null;
  qcStartedAt: string | null;
  qcCompletedAt: string | null;
  warehousedAt: string | null;
  returnedAt: string | null;
  lotNo: string | null;
  invoiceNo: string | null;
  qcNotes: string | null;
  qcAnalyst: string | null;
}): RawMaterialOrder {
  return {
    id: row.id,
    orderNo: row.orderNo,
    materialName: row.materialName,
    sku: row.sku,
    supplier: row.supplier,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: asNumber(row.unitPrice),
    totalPrice: asNumber(row.totalPrice),
    status: row.status as RawMaterialOrderStatus,
    source: row.source as RawMaterialOrderSource,
    sourceNote: row.sourceNote ?? undefined,
    targetWarehouseId: row.targetWarehouseId,
    orderDate: row.orderDate,
    expectedDelivery: row.expectedDelivery ?? undefined,
    receivedDate: row.receivedDate ?? undefined,
    qcStartedAt: row.qcStartedAt ?? undefined,
    qcCompletedAt: row.qcCompletedAt ?? undefined,
    warehousedAt: row.warehousedAt ?? undefined,
    returnedAt: row.returnedAt ?? undefined,
    lotNo: row.lotNo ?? undefined,
    invoiceNo: row.invoiceNo ?? undefined,
    qcNotes: row.qcNotes ?? undefined,
    qcAnalyst: row.qcAnalyst ?? undefined,
  };
}

type AuditCtx = { actor: string; ip?: string };

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "picking",
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

const ORDER_PRIORITIES = ["normal", "high", "urgent"] as const;
const LINE_STATUSES = [
  "active",
  "maintenance",
  "idle",
  "alert",
] as const satisfies readonly ProductionLineStatus[];
const RECIPE_STATUSES = ["draft", "saved"] as const;
const RMO_EDITABLE_STATUSES: RawMaterialOrderStatus[] = ["to_order", "ordered"];

// ─── Orders ─────────────────────────────────────────────────────────────────

function toOrder(row: {
  id: string;
  orderNo: string;
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  status: string;
  orderDate: string;
  deliveryDate: string;
  priority: string;
  warehouse: string;
  value: unknown;
  recipeNo: string | null;
  batchNo?: string | null;
  destination?: string | null;
  shipmentNote?: string | null;
}): Order {
  return {
    id: row.id,
    orderNo: row.orderNo,
    customer: row.customer,
    product: row.product,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status as Order["status"],
    orderDate: row.orderDate,
    deliveryDate: row.deliveryDate,
    priority: row.priority as Order["priority"],
    warehouse: row.warehouse,
    value: asNumber(row.value),
    recipeNo: row.recipeNo ?? undefined,
    batchNo: row.batchNo ?? undefined,
    destination: row.destination ?? undefined,
    shipmentNote: row.shipmentNote ?? undefined,
  };
}

async function nextSalesOrderNo(): Promise<string> {
  const rows = await prisma.order.findMany({ select: { orderNo: true } });
  const year = new Date().getFullYear();
  let max = 0;
  for (const o of rows) {
    const match = o.orderNo.match(/SIP-\d+-(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `SIP-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function defaultShipmentWarehouseName(): Promise<string> {
  const packaging = await prisma.warehouse.findFirst({
    where: { type: "packaging" },
    orderBy: { name: "asc" },
  });
  if (packaging?.name) return packaging.name;
  return getWarehouseName(WAREHOUSE_IDS.packaging);
}

async function enqueueShipmentForCompletedBatch(
  batch: ProductionBatch,
  ctx: AuditCtx
): Promise<Order> {
  const existing = await prisma.order.findFirst({
    where: { batchNo: batch.batchNo },
  });
  if (existing) return toOrder(existing);

  const openOrders = await prisma.order.findMany({
    where: {
      batchNo: null,
      status: { in: ["pending", "confirmed"] },
    },
    orderBy: { orderDate: "asc" },
  });
  const productKey = batch.product.trim().toLocaleLowerCase("tr");
  const match = openOrders.find(
    (o) => o.product.trim().toLocaleLowerCase("tr") === productKey
  );

  if (match) {
    const before = toOrder(match);
    const row = await prisma.order.update({
      where: { id: match.id },
      data: {
        batchNo: batch.batchNo,
        status: match.status === "pending" ? "confirmed" : match.status,
      },
    });
    const after = toOrder(row);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "Order",
      entityId: after.id,
      summary: `Parti sevkiyata bağlandı: ${batch.batchNo} → ${after.orderNo}`,
      before,
      after,
      ipAddress: ctx.ip,
    });
    return after;
  }

  const order: Order = {
    id: `o-svk-${batch.id}`,
    orderNo: await nextSalesOrderNo(),
    customer: PRODUCTION_SHIPMENT_CUSTOMER,
    product: batch.product,
    quantity: batch.quantity,
    unit: batch.unit,
    status: "confirmed",
    orderDate: todayIso(),
    deliveryDate: todayIso(),
    priority: "normal",
    warehouse: await defaultShipmentWarehouseName(),
    value: 0,
    batchNo: batch.batchNo,
  };
  await prisma.order.create({
    data: {
      id: order.id,
      orderNo: order.orderNo,
      customer: order.customer,
      product: order.product,
      quantity: order.quantity,
      unit: order.unit,
      status: order.status,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      priority: order.priority,
      warehouse: order.warehouse,
      value: order.value,
      batchNo: batch.batchNo,
    },
  });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Order",
    entityId: order.id,
    summary: `Sevkiyat oluştu (KK onay): ${order.orderNo} · ${batch.batchNo}`,
    after: order,
    ipAddress: ctx.ip,
  });
  return order;
}

export async function dbGetAllOrders(): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    orderBy: { orderDate: "desc" },
  });
  return rows.map(toOrder);
}

export async function dbGetOrder(id: string): Promise<Order | undefined> {
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? toOrder(row) : undefined;
}

export async function dbCreateOrder(
  input: unknown,
  ctx: AuditCtx
): Promise<Order> {
  const body = asRecord(input);
  const customer = asString(body.customer, "customer")!;
  const product = asString(body.product, "product")!;
  const quantity = asFiniteNumber(body.quantity, "quantity", { min: 0.0001 })!;
  const unit = asString(body.unit, "unit")!;
  const status = asEnum(body.status, ORDER_STATUSES, "status")!;
  const orderDate = asIsoDate(body.orderDate, "orderDate")!;
  const deliveryDate = asIsoDate(body.deliveryDate, "deliveryDate")!;
  const priority = asEnum(body.priority, ORDER_PRIORITIES, "priority")!;
  const warehouse = asString(body.warehouse, "warehouse")!;
  const value = asFiniteNumber(body.value, "value", { min: 0 })!;
  if (deliveryDate < orderDate) {
    throw new FieldError("Teslimat tarihi sipariş tarihinden önce olamaz");
  }

  const order: Order = {
    id: `o-${Date.now()}`,
    orderNo: await nextSalesOrderNo(),
    customer,
    product,
    quantity,
    unit,
    status,
    orderDate,
    deliveryDate,
    priority,
    warehouse,
    value,
  };
  await prisma.order.create({ data: order });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Order",
    entityId: order.id,
    summary: `Sipariş oluşturuldu: ${order.orderNo}`,
    after: order,
    ipAddress: ctx.ip,
  });
  return order;
}

function stockNorm(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[İIıi]/g, "i")
    .toLocaleLowerCase("tr");
}

function matchesShipmentProduct(
  item: { name: string; sku: string },
  product: string
): boolean {
  const key = stockNorm(product);
  return stockNorm(item.name) === key || stockNorm(item.sku) === key;
}

async function deductStockForShipment(
  tx: Prisma.TransactionClient,
  order: {
    product: string;
    quantity: number;
    unit: string;
    warehouse: string;
    batchNo?: string;
    stockItemId?: string;
    kind?: "finished" | "material";
  }
): Promise<void> {
  const needed = order.quantity;
  if (!(needed > 0)) return;

  const warehouses = await tx.warehouse.findMany({
    select: { id: true, name: true },
  });
  const warehouseKey = stockNorm(order.warehouse);
  const preferredWarehouseId = warehouses.find(
    (w) => w.id === order.warehouse || stockNorm(w.name) === warehouseKey
  )?.id;

  const all = await tx.warehouseStockItem.findMany({
    where: { quantity: { gt: 0 } },
  });

  let items = all.filter((item) => matchesShipmentProduct(item, order.product));
  if (order.stockItemId) {
    const selected =
      all.find((item) => item.id === order.stockItemId) ??
      (await tx.warehouseStockItem.findUnique({
        where: { id: order.stockItemId },
      }));
    if (!selected) throw new FieldError("Stok kalemi bulunamadı");
    if (selected.quantity <= 0) {
      throw new FieldError("Seçilen stok kaleminde miktar yok");
    }
    const selectedName = stockNorm(selected.name);
    const selectedSku = stockNorm(selected.sku);
    items = all.filter(
      (item) =>
        item.id === selected.id ||
        stockNorm(item.name) === selectedName ||
        (selectedSku && stockNorm(item.sku) === selectedSku)
    );
    if (!items.some((item) => item.id === selected.id)) {
      items = [selected, ...items];
    }
  }

  if (order.kind !== "material") {
    items = items.filter((item) => stockNorm(item.category) === "mamul");
  }

  if (items.length === 0) {
    throw new FieldError(
      order.kind === "material"
        ? `Stokta bu ürün yok: ${order.product}`
        : `Hazır mamul stoku yok: ${order.product}`
    );
  }

  const available = items.reduce((sum, item) => sum + item.quantity, 0);
  if (available + 1e-9 < needed) {
    throw new FieldError(
      `Yetersiz stok: ${order.product} için ${available} ${order.unit} var, ${needed} ${order.unit} gerekli`
    );
  }

  const lotKey = order.batchNo ? stockNorm(order.batchNo) : "";
  const unitKey = stockNorm(order.unit);
  const preferredItemId = order.stockItemId ?? "";
  items.sort((a, b) => {
    const rank = (item: (typeof items)[number]) => {
      const preferred = item.id === preferredItemId ? 0 : 1;
      const warehouse =
        item.warehouseId === preferredWarehouseId
          ? 0
          : item.warehouseId === WAREHOUSE_IDS.finishedFactory
            ? 1
            : item.warehouseId === WAREHOUSE_IDS.finishedInternet
              ? 2
              : item.warehouseId === WAREHOUSE_IDS.production
                ? 3
                : 4;
      const lot = lotKey && stockNorm(item.lotNo) === lotKey ? 0 : 1;
      const unit = stockNorm(item.unit) === unitKey ? 0 : 1;
      const catKey = stockNorm(item.category);
      const category =
        order.kind === "material"
          ? catKey === "mamul"
            ? 2
            : catKey.includes("ham") || catKey.includes("eksipiyan")
              ? 0
              : 1
          : catKey === "mamul"
            ? 0
            : 1;
      return [preferred, warehouse, lot, unit, category] as const;
    };
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i];
    }
    const da = a.expiryDate
      ? parseLocalDate(a.expiryDate).getTime()
      : Number.POSITIVE_INFINITY;
    const db = b.expiryDate
      ? parseLocalDate(b.expiryDate).getTime()
      : Number.POSITIVE_INFINITY;
    return da - db;
  });

  let remaining = needed;
  for (const item of items) {
    if (remaining <= 1e-9) break;
    const take = Math.min(item.quantity, remaining);
    if (!(take > 0)) continue;
    const nextQty = item.quantity - take;
    await tx.warehouseStockItem.update({
      where: { id: item.id },
      data: {
        quantity: nextQty,
        status: deriveStockStatus(nextQty, item.minStock, item.expiryDate),
      },
    });
    remaining -= take;
  }

  if (remaining > 1e-9) {
    throw new FieldError(
      `Yetersiz stok: ${order.product} için sevk miktarı karşılanamadı`
    );
  }
}

export async function dbUpdateOrderShipment(
  id: string,
  input: {
    status?: Order["status"];
    warehouse?: string;
    customer?: string;
    destination?: string;
    shipmentNote?: string;
    stockItemId?: string;
    quantity?: number;
  },
  ctx: AuditCtx
): Promise<Order> {
  const raw = await prisma.order.findUnique({ where: { id } });
  if (!raw) throw new Error("Sipariş bulunamadı");
  const before = toOrder(raw);
  const data: {
    status?: Order["status"];
    warehouse?: string;
    customer?: string;
    destination?: string | null;
    shipmentNote?: string | null;
    quantity?: number;
    stockDeducted?: boolean;
  } = {};
  if (input.status && input.status !== before.status) data.status = input.status;
  if (input.warehouse && input.warehouse !== before.warehouse) {
    data.warehouse = input.warehouse;
  }
  if (input.customer && input.customer !== before.customer) {
    data.customer = input.customer;
  }
  if (input.destination !== undefined && input.destination !== before.destination) {
    data.destination = input.destination;
  }
  if (input.shipmentNote !== undefined) {
    const note = input.shipmentNote.trim() || null;
    if (note !== (before.shipmentNote ?? null)) data.shipmentNote = note;
  }

  const nextStatus = data.status ?? before.status;
  const becomingShipped =
    nextStatus === "shipped" && before.status !== "shipped";
  if (nextStatus === "shipped") {
    const customer = (data.customer ?? before.customer).trim();
    const destination = (data.destination ?? before.destination ?? "").trim();
    if (isUnsetShipmentCustomer(customer) || !destination) {
      throw new FieldError("Sevk için müşteri ve teslimat yeri gerekli");
    }
    data.customer = customer;
    data.destination = destination;
  }

  const shipQty =
    input.quantity !== undefined && input.quantity > 0
      ? input.quantity
      : before.quantity;
  if (becomingShipped) {
    if (!(shipQty > 0)) throw new FieldError("Sevk miktarı pozitif olmalıdır");
    if (shipQty > before.quantity) {
      throw new FieldError(
        `En fazla ${before.quantity} ${before.unit} sevk edilebilir`
      );
    }
    if (shipQty !== before.quantity) data.quantity = shipQty;
  }

  const shouldDeduct = becomingShipped && !raw.stockDeducted;
  if (shouldDeduct) data.stockDeducted = true;

  if (Object.keys(data).length === 0) return before;
  const row = await prisma.$transaction(async (tx) => {
    if (shouldDeduct) {
      await deductStockForShipment(tx, {
        product: before.product,
        quantity: shipQty,
        unit: before.unit,
        warehouse: data.warehouse ?? before.warehouse,
        batchNo: before.batchNo,
        stockItemId: input.stockItemId?.trim() || undefined,
      });
    }
    return tx.order.update({ where: { id }, data });
  });
  const after = toOrder(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Order",
    entityId: id,
    summary:
      after.status === "shipped" && after.destination
        ? shouldDeduct
          ? `Sevke çıktı: ${after.orderNo} → ${after.customer} (${after.destination}) · stoktan ${shipQty} ${before.unit} düşüldü`
          : `Sevke çıktı: ${after.orderNo} → ${after.customer} (${after.destination})`
        : `Sevkiyat güncellendi: ${after.orderNo}`,
    before,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

export async function dbCreateShipment(
  input: {
    customer: string;
    destination: string;
    stockItemId: string;
    quantity: number;
    warehouse?: string;
    shipmentNote?: string;
  },
  ctx: AuditCtx
): Promise<Order> {
  const customer = input.customer.trim();
  const destination = input.destination.trim();
  if (isUnsetShipmentCustomer(customer) || !destination) {
    throw new FieldError("Sevk için müşteri ve teslimat yeri gerekli");
  }
  const quantity = input.quantity;
  if (!(quantity > 0)) throw new FieldError("Sevk miktarı pozitif olmalıdır");

  const stockItem = await prisma.warehouseStockItem.findUnique({
    where: { id: input.stockItemId.trim() },
  });
  if (!stockItem) throw new FieldError("Mamul stok kalemi bulunamadı");
  if (stockNorm(stockItem.category) !== "mamul") {
    throw new FieldError("Sadece mamul ürün sevk edilebilir");
  }
  if (quantity > stockItem.quantity) {
    throw new FieldError(
      `Yetersiz stok: ${stockItem.quantity} ${stockItem.unit} kaldı`
    );
  }

  const warehouse =
    input.warehouse?.trim() ||
    getWarehouseName(stockItem.warehouseId) ||
    (await defaultShipmentWarehouseName());
  const today = todayIso();
  const orderId = `o-${Date.now()}`;
  const orderNo = await nextSalesOrderNo();

  const row = await prisma.$transaction(async (tx) => {
    await deductStockForShipment(tx, {
      product: stockItem.name,
      quantity,
      unit: stockItem.unit,
      warehouse,
      batchNo: stockItem.lotNo,
      stockItemId: stockItem.id,
      kind: "finished",
    });
    return tx.order.create({
      data: {
        id: orderId,
        orderNo,
        customer,
        product: stockItem.name,
        quantity,
        unit: stockItem.unit,
        status: "shipped",
        orderDate: today,
        deliveryDate: today,
        priority: "normal",
        warehouse,
        value: 0,
        batchNo: stockItem.lotNo || null,
        destination,
        shipmentNote: input.shipmentNote?.trim() || null,
        stockDeducted: true,
      },
    });
  });

  const after = toOrder(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Order",
    entityId: after.id,
    summary: `Yeni sevk: ${after.orderNo} · ${after.product} · ${quantity} ${after.unit} → ${after.customer}`,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

// ─── Recipes ────────────────────────────────────────────────────────────────

export async function dbGetAllRecipes(): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany();
  return rows.map(toRecipe);
}

export async function dbGetRecipeByOrderId(orderId: string): Promise<Recipe | undefined> {
  const row = await prisma.recipe.findFirst({ where: { orderId } });
  return row ? toRecipe(row) : undefined;
}

export async function dbGetRecipeForOrder(order: {
  id: string;
  product: string;
  recipeNo?: string;
}): Promise<Recipe | undefined> {
  const all = await dbGetAllRecipes();
  return (
    all.find((r) => r.orderId === order.id) ??
    (order.recipeNo
      ? all.find(
          (r) => (r.code ?? "").toLowerCase() === order.recipeNo!.toLowerCase()
        )
      : undefined) ??
    all.find(
      (r) =>
        r.productName.trim().toLocaleLowerCase("tr") ===
        order.product.trim().toLocaleLowerCase("tr")
    )
  );
}

export async function dbNextRecipeCode(): Promise<string> {
  const all = await dbGetAllRecipes();
  let max = 0;
  for (const r of all) {
    const match = (r.code ?? "").match(/^REC-(\d+)$/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `REC-${String(max + 1).padStart(3, "0")}`;
}

export async function dbUpdateRecipe(
  input: unknown,
  ctx: AuditCtx
): Promise<Recipe> {
  const body = asRecord(input);
  const id = asString(body.id, "id")!;
  const before = await prisma.recipe.findUnique({ where: { id } });
  if (!before) throw new FieldError("Reçete bulunamadı");

  const existing = toRecipe(before);
  const productName =
    asString(body.productName, "productName", { optional: true }) ??
    existing.productName;
  const productCode =
    asString(body.productCode, "productCode", { optional: true, max: 80 }) ??
    existing.productCode ??
    "";
  const code =
    asString(body.code, "code", { optional: true, max: 40 }) ??
    existing.code ??
    "";
  const status =
    asEnum(body.status, RECIPE_STATUSES, "status", { optional: true }) ??
    existing.status;

  if (code) {
    const clash = await prisma.recipe.findFirst({
      where: {
        id: { not: id },
        code: { equals: code, mode: "insensitive" },
      },
    });
    if (clash) throw new FieldError("Bu reçete kodu zaten kayıtlı");
  }

  let lines = existing.lines;
  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines)) {
      throw new FieldError("lines bir dizi olmalıdır");
    }
    lines = normalizeRecipeLines(body.lines);
    if (lines.length === 0) {
      throw new FieldError("En az bir hammadde satırı zorunludur");
    }
  }

  let extras = existing.extras;
  if (body.extras !== undefined) {
    if (!Array.isArray(body.extras)) {
      throw new FieldError("extras bir dizi olmalıdır");
    }
    extras = normalizeRecipeExtras(body.extras);
  }

  const catalog = await dbGetAllRawMaterials();
  lines = lines.map((l) => {
    const materialName = (l.materialName ?? "").trim();
    const found =
      catalog.find((m) => m.id === l.materialId) ??
      catalog.find(
        (m) =>
          m.name.trim().toLocaleLowerCase("tr") ===
          materialName.toLocaleLowerCase("tr")
      );
    return {
      materialId: found?.id ?? l.materialId ?? "",
      materialName: found?.name ?? materialName,
      unit: l.unit?.trim() || found?.unit || "mg",
      quantityPerUnit: l.quantityPerUnit,
    };
  });

  const recipe: Recipe = {
    id: existing.id,
    code,
    productCode,
    orderId: existing.orderId,
    productName: productName.trim(),
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    lines,
    extras,
    status,
  };
  return dbSaveRecipe(recipe, ctx);
}

function normalizeRecipeLines(raw: unknown[]): RecipeLine[] {
  return raw
    .map((item) => {
      const row = asRecord(item);
      const materialName =
        asString(row.materialName, "materialName", { optional: true }) ?? "";
      const materialId =
        asString(row.materialId, "materialId", { optional: true }) ?? "";
      const unit = asString(row.unit, "unit", { optional: true }) ?? "mg";
      const quantityPerUnit = asFiniteNumber(
        row.quantityPerUnit,
        "quantityPerUnit",
        { min: 0 }
      )!;
      return { materialId, materialName, unit, quantityPerUnit };
    })
    .filter((l) => (l.materialName || l.materialId) && l.quantityPerUnit > 0);
}

function normalizeRecipeExtras(raw: unknown[]): RecipeExtra[] {
  return raw.map((item) => {
    const row = asRecord(item);
    return {
      id: asString(row.id, "extra.id", { optional: true }) ?? `ext-${Date.now()}`,
      materialId: asString(row.materialId, "extra.materialId")!,
      quantity: asFiniteNumber(row.quantity, "extra.quantity", { min: 0 })!,
      reason: asString(row.reason, "extra.reason", { optional: true, max: 500 }) ?? "",
    };
  });
}

export async function dbSaveRecipe(recipe: Recipe, ctx: AuditCtx): Promise<Recipe> {
  const before = await prisma.recipe.findUnique({ where: { id: recipe.id } });
  const data = {
    id: recipe.id,
    code: recipe.code ?? null,
    productCode: recipe.productCode ?? null,
    orderId: recipe.orderId,
    productName: recipe.productName,
    createdAt: recipe.createdAt,
    createdBy: recipe.createdBy,
    lines: JSON.stringify(recipe.lines),
    extras: JSON.stringify(recipe.extras),
    status: recipe.status,
  };
  await prisma.recipe.upsert({
    where: { id: recipe.id },
    create: data,
    update: data,
  });
  await logAudit({
    actor: ctx.actor,
    action: before ? "UPDATE" : "CREATE",
    entityType: "Recipe",
    entityId: recipe.id,
    summary: `Reçete ${before ? "güncellendi" : "kaydedildi"}: ${recipe.code || recipe.productName}`,
    before: before ? toRecipe(before) : undefined,
    after: recipe,
    ipAddress: ctx.ip,
  });
  return recipe;
}

export async function dbCreateRecipe(
  input: CreateRecipeInput,
  ctx: AuditCtx
): Promise<Recipe> {
  const productName = input.productName.trim();
  if (!productName) throw new Error("Ürün adı zorunludur");

  const catalog = await dbGetAllRawMaterials();
  const lines = input.lines
    .map((l) => {
      const materialName = l.materialName.trim();
      const found = catalog.find(
        (m) =>
          m.name.trim().toLocaleLowerCase("tr") ===
          materialName.toLocaleLowerCase("tr")
      );
      return {
        materialId: found?.id ?? "",
        materialName: found?.name ?? materialName,
        unit: l.unit.trim() || found?.unit || "mg",
        quantityPerUnit: l.quantityPerUnit,
      };
    })
    .filter((l) => l.materialName && l.quantityPerUnit > 0);

  if (lines.length === 0) {
    throw new Error("En az bir hammadde satırı (ad ve miktar) zorunludur");
  }

  const code = input.code?.trim() || (await dbNextRecipeCode());
  const all = await dbGetAllRecipes();
  if (all.some((r) => (r.code ?? "").toLowerCase() === code.toLowerCase())) {
    throw new Error("Bu reçete kodu zaten kayıtlı");
  }

  const recipe: Recipe = {
    id: `rec-${Date.now()}`,
    code,
    productCode: input.productCode?.trim() ?? "",
    orderId: "",
    productName,
    createdAt: todayIso(),
    createdBy: ctx.actor,
    lines,
    extras: [],
    status: "saved",
  };
  return dbSaveRecipe(recipe, ctx);
}

export async function dbCreateEmptyRecipe(
  orderId: string,
  productName: string,
  createdBy: string
): Promise<Recipe> {
  const all = await dbGetAllRecipes();
  const materials = await dbGetAllRawMaterials();
  const existing = all.find(
    (r) =>
      r.productName.trim().toLocaleLowerCase("tr") ===
      productName.trim().toLocaleLowerCase("tr")
  );
  if (existing) {
    return {
      ...existing,
      id: `rec-${Date.now()}`,
      orderId,
      createdAt: todayIso(),
      createdBy,
      status: "draft",
    };
  }
  return {
    id: `rec-${Date.now()}`,
    code: "",
    productCode: "",
    orderId,
    productName,
    createdAt: todayIso(),
    createdBy,
    lines: [
      {
        materialId: materials[0]?.id ?? "",
        materialName: materials[0]?.name ?? "",
        unit: materials[0]?.unit ?? "mg",
        quantityPerUnit: 0,
      },
    ],
    extras: [],
    status: "draft",
  };
}

// ─── Raw Materials ──────────────────────────────────────────────────────────

function toRawMaterial(row: {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCost: unknown;
}): RawMaterial {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    unitCost: asNumber(row.unitCost),
  };
}

export async function dbGetAllRawMaterials(): Promise<RawMaterial[]> {
  const rows = await prisma.rawMaterial.findMany();
  return rows.map(toRawMaterial);
}

export async function dbGetRawMaterialById(id: string): Promise<RawMaterial | undefined> {
  const row = await prisma.rawMaterial.findUnique({ where: { id } });
  return row ? toRawMaterial(row) : undefined;
}

export async function dbGetRawMaterialBySku(sku: string): Promise<RawMaterial | undefined> {
  const key = sku.trim().toLowerCase();
  const all = await dbGetAllRawMaterials();
  return all.find((m) => m.sku.toLowerCase() === key);
}

export async function dbCreateRawMaterial(
  input: CreateRawMaterialInput,
  ctx: AuditCtx
): Promise<RawMaterial> {
  const sku = input.sku.trim();
  if (await dbGetRawMaterialBySku(sku)) {
    throw new Error("Bu SKU zaten kayıtlı");
  }
  const material: RawMaterial = {
    id: `rm-${Date.now()}`,
    sku,
    name: input.name.trim(),
    category: input.category,
    unit: input.unit,
    unitCost: input.unitCost,
  };
  await prisma.rawMaterial.create({ data: material });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "RawMaterial",
    entityId: material.id,
    summary: `Hammadde eklendi: ${material.name} (${material.sku})`,
    after: material,
    ipAddress: ctx.ip,
  });
  return material;
}

// ─── Stock ──────────────────────────────────────────────────────────────────

export async function dbGetAllWarehouseStockItems(): Promise<WarehouseStockItem[]> {
  const rows = await prisma.warehouseStockItem.findMany();
  return rows.map(toStockItem);
}

function deriveStockStatus(
  quantity: number,
  minStock: number,
  expiryDate: string
): import("@/data/mock").StockStatus {
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

async function upsertWarehouseStockItem(
  db: Prisma.TransactionClient | typeof prisma,
  input: CreateStockInput,
  idPrefix = "ws-manual"
): Promise<{ item: WarehouseStockItem; created: boolean; added: number }> {
  const sku = input.sku.trim();
  const name = input.name.trim();
  const lotNo = input.lotNo.trim();
  const existing = await db.warehouseStockItem.findFirst({
    where: {
      warehouseId: input.warehouseId,
      sku,
      lotNo,
    },
  });
  if (existing) {
    const quantity = existing.quantity + input.quantity;
    const minStock = Math.max(existing.minStock, input.minStock);
    const expiryDate = input.expiryDate || existing.expiryDate;
    const row = await db.warehouseStockItem.update({
      where: { id: existing.id },
      data: {
        name,
        category: input.category,
        quantity,
        unit: input.unit,
        minStock,
        expiryDate,
        status: deriveStockStatus(quantity, minStock, expiryDate),
      },
    });
    return { item: toStockItem(row), created: false, added: input.quantity };
  }

  const item: WarehouseStockItem = {
    id: `${idPrefix}-${Date.now()}`,
    sku,
    name,
    category: input.category,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    unit: input.unit,
    minStock: input.minStock,
    lotNo,
    expiryDate: input.expiryDate,
    status:
      input.status ??
      deriveStockStatus(input.quantity, input.minStock, input.expiryDate),
    temperature: input.temperature?.trim() || undefined,
    labDirectEntry: input.labDirectEntry || undefined,
    replenishFromWarehouseId: input.replenishFromWarehouseId,
    labTargetQuantity: input.labTargetQuantity,
  };
  await db.warehouseStockItem.create({
    data: {
      ...item,
      maxStock: null,
      temperature: item.temperature ?? null,
      replenishFromWarehouseId: item.replenishFromWarehouseId ?? null,
      labTargetQuantity: item.labTargetQuantity ?? null,
      labDirectEntry: item.labDirectEntry ?? false,
    },
  });
  return { item, created: true, added: input.quantity };
}

export async function dbCreateStockEntry(
  input: CreateStockInput,
  ctx: AuditCtx
): Promise<WarehouseStockItem> {
  const { item, created, added } = await upsertWarehouseStockItem(prisma, input);
  await logAudit({
    actor: ctx.actor,
    action: created ? "CREATE" : "UPDATE",
    entityType: "WarehouseStockItem",
    entityId: item.id,
    summary: created
      ? `Stok girişi: ${item.name} (${item.quantity} ${item.unit})`
      : `Stok girişi (lot birleştirildi): ${item.name} +${added} ${item.unit} → ${item.quantity} ${item.unit}`,
    after: item,
    ipAddress: ctx.ip,
  });
  return item;
}

async function addProducedGoodsStock(
  tx: Prisma.TransactionClient,
  batch: ProductionBatch
): Promise<void> {
  if (!(batch.quantity > 0)) return;
  const catalog = await tx.finishedProduct.findMany();
  const catalogHit = catalog.find(
    (p) => matchNameKey(p.name) === matchNameKey(batch.product)
  );
  const recipes = await dbGetAllRecipes();
  const recipe = findRecipeByProductName(recipes, batch.product);
  const sku =
    catalogHit?.sku?.trim() ||
    recipe?.productCode?.trim() ||
    `MML-${batch.product.trim().replace(/\s+/g, "-")}`;
  await upsertWarehouseStockItem(
    tx,
    {
      sku,
      name: batch.product.trim(),
      category: "Mamul",
      warehouseId: WAREHOUSE_IDS.finishedFactory,
      quantity: batch.quantity,
      unit: batch.unit,
      minStock: catalogHit?.minStock ?? 0,
      lotNo: batch.batchNo,
      expiryDate: catalogHit?.expiryDate || plusYearsIso(2),
    },
    `ws-mml-${batch.id}`
  );
}

// ─── Raw Material Orders ────────────────────────────────────────────────────

const OPEN_STATUSES = new Set(["to_order", "ordered", "received", "qc_pending"]);

async function buildLowStockDrafts(
  existingOrders: RawMaterialOrder[]
): Promise<RawMaterialOrder[]> {
  const openSkus = new Set(
    existingOrders.filter((o) => OPEN_STATUSES.has(o.status)).map((o) => o.sku)
  );
  const stock = await dbGetAllWarehouseStockItems();
  const materials = await dbGetAllRawMaterials();
  const drafts: RawMaterialOrder[] = [];
  const today = todayIso();

  for (const item of stock) {
    if (item.warehouseId !== WAREHOUSE_IDS.production) continue;
    const belowMin = item.minStock > 0 && item.quantity < item.minStock;
    const alertStatus = item.status === "low" || item.status === "critical";
    if (!belowMin && !alertStatus) continue;
    if (openSkus.has(item.sku)) continue;

    const unitCost =
      materials.find((r) => r.sku === item.sku)?.unitCost ?? 1000;
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

export async function dbGetAllRawMaterialOrders(): Promise<RawMaterialOrder[]> {
  const rows = await prisma.rawMaterialOrder.findMany({
    orderBy: { orderDate: "desc" },
  });
  return rows.map(toRmo);
}

export async function dbGetRawMaterialOrder(id: string): Promise<RawMaterialOrder | undefined> {
  const row = await prisma.rawMaterialOrder.findUnique({ where: { id } });
  return row ? toRmo(row) : undefined;
}

export async function dbPatchRawMaterialOrder(
  input: unknown,
  ctx: AuditCtx
): Promise<RawMaterialOrder> {
  const body = asRecord(input);
  const id = asString(body.id, "id")!;
  const existing = await dbGetRawMaterialOrder(id);
  if (!existing) throw new FieldError("Sipariş bulunamadı");

  if (!RMO_EDITABLE_STATUSES.includes(existing.status)) {
    throw new FieldError(
      "Bu durumdaki sipariş düzenlenemez. Durum değişiklikleri yalnızca akış adımlarından yapılır."
    );
  }

  const supplier =
    asString(body.supplier, "supplier", { optional: true, max: 200 }) ??
    existing.supplier;
  const quantity =
    asFiniteNumber(body.quantity, "quantity", { min: 0, optional: true }) ??
    existing.quantity;
  const unitPrice =
    asFiniteNumber(body.unitPrice, "unitPrice", { min: 0, optional: true }) ??
    existing.unitPrice;
  const unit =
    asString(body.unit, "unit", { optional: true }) ?? existing.unit;
  const expectedDelivery =
    body.expectedDelivery === null
      ? undefined
      : (asIsoDate(body.expectedDelivery, "expectedDelivery", {
          optional: true,
        }) ?? existing.expectedDelivery);
  const sourceNote =
    body.sourceNote === null
      ? undefined
      : (asString(body.sourceNote, "sourceNote", {
          optional: true,
          max: 500,
        }) ?? existing.sourceNote);
  const targetWarehouseId =
    asString(body.targetWarehouseId, "targetWarehouseId", { optional: true }) ??
    existing.targetWarehouseId;
  const sourceRaw = asString(body.source, "source", { optional: true });
  const source =
    sourceRaw === "low_stock" ||
    sourceRaw === "production_need" ||
    sourceRaw === "manual" ||
    sourceRaw === "delivery_note"
      ? sourceRaw
      : existing.source;
  const orderDate =
    asIsoDate(body.orderDate, "orderDate", { optional: true }) ?? existing.orderDate;

  const updated: RawMaterialOrder = {
    ...existing,
    supplier,
    quantity,
    unitPrice,
    unit,
    totalPrice: quantity * unitPrice,
    expectedDelivery,
    sourceNote,
    targetWarehouseId,
    source,
    orderDate,
  };
  return dbSaveRawMaterialOrder(updated, ctx);
}

export async function dbSaveRawMaterialOrder(
  order: RawMaterialOrder,
  ctx: AuditCtx
): Promise<RawMaterialOrder> {
  const before = await prisma.rawMaterialOrder.findUnique({ where: { id: order.id } });
  const data = {
    id: order.id,
    orderNo: order.orderNo,
    materialName: order.materialName,
    sku: order.sku,
    supplier: order.supplier,
    quantity: order.quantity,
    unit: order.unit,
    unitPrice: order.unitPrice,
    totalPrice: order.totalPrice,
    status: order.status,
    source: order.source,
    sourceNote: order.sourceNote ?? null,
    targetWarehouseId: order.targetWarehouseId,
    orderDate: order.orderDate,
    expectedDelivery: order.expectedDelivery ?? null,
    receivedDate: order.receivedDate ?? null,
    qcStartedAt: order.qcStartedAt ?? null,
    qcCompletedAt: order.qcCompletedAt ?? null,
    warehousedAt: order.warehousedAt ?? null,
    returnedAt: order.returnedAt ?? null,
    lotNo: order.lotNo ?? null,
    invoiceNo: order.invoiceNo ?? null,
    qcNotes: order.qcNotes ?? null,
    qcAnalyst: order.qcAnalyst ?? null,
  };
  await prisma.rawMaterialOrder.upsert({
    where: { id: order.id },
    create: data,
    update: data,
  });
  await logAudit({
    actor: ctx.actor,
    action: before ? "UPDATE" : "CREATE",
    entityType: "RawMaterialOrder",
    entityId: order.id,
    summary: `Hammadde siparişi ${before ? "güncellendi" : "kaydedildi"}: ${order.orderNo}`,
    before: before ? toRmo(before) : undefined,
    after: order,
    ipAddress: ctx.ip,
  });
  return order;
}

export async function dbSyncReplenishmentOrders(ctx: AuditCtx): Promise<RawMaterialOrder[]> {
  const current = await dbGetAllRawMaterialOrders();
  const drafts = await buildLowStockDrafts(current);
  let created = 0;
  for (const draft of drafts) {
    if (!current.some((o) => o.id === draft.id)) {
      await dbSaveRawMaterialOrder(draft, ctx);
      created++;
    }
  }
  if (created > 0) {
    await logAudit({
      actor: ctx.actor,
      action: "SYNC",
      entityType: "RawMaterialOrder",
      summary: `${created} otomatik stok uyarısı siparişi oluşturuldu`,
      ipAddress: ctx.ip,
    });
  }
  return dbGetAllRawMaterialOrders();
}

function nextHmOrderNo(existing: RawMaterialOrder[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const order of existing) {
    const match = order.orderNo.match(/HM-(?:AUTO-)?(\d+)-(\d+)/);
    if (match && match[1] === String(year)) {
      max = Math.max(max, parseInt(match[2], 10));
    }
  }
  return `HM-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function dbCreateManualRawMaterialOrder(
  input: {
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
  },
  ctx: AuditCtx
): Promise<RawMaterialOrder> {
  const qty = input.quantity;
  const existing = await dbGetAllRawMaterialOrders();
  const order: RawMaterialOrder = {
    id: `rmo-manual-${Date.now()}`,
    orderNo: nextHmOrderNo(existing),
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
  return dbSaveRawMaterialOrder(order, ctx);
}

const DELIVERY_NOTE_QC_NOTE = "İrsaliye";

async function resolveReceiptWarehouseId(warehouseName: string): Promise<string> {
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, name: true, type: true },
  });
  const key = matchNameKey(warehouseName);
  const named = warehouses.find(
    (row) => row.id === warehouseName || matchNameKey(row.name) === key
  );
  if (named) return named.id;
  const production = warehouses.find((row) => row.id === WAREHOUSE_IDS.production);
  if (production) return production.id;
  const raw = warehouses.find((row) => row.type !== "finished");
  return raw?.id ?? warehouses[0]?.id ?? WAREHOUSE_IDS.production;
}

export async function dbEnqueueQcFromDeliveryNote(
  note: DeliveryNote,
  lines: { description: string; quantityLabel: string; unit: string }[],
  ctx: AuditCtx
): Promise<number> {
  if (note.kind !== "Alış") return 0;
  const today = todayIso();
  const [materials, products, existing] = await Promise.all([
    dbGetAllRawMaterials(),
    dbGetProducts(),
    dbGetAllRawMaterialOrders(),
  ]);
  const targetWarehouseId = await resolveReceiptWarehouseId(note.warehouse);
  const sourceNote = `${DELIVERY_NOTE_QC_NOTE} ${note.noteNo.trim()}`;
  let queued = 0;
  const working = [...existing];

  for (const [index, line] of lines.entries()) {
    const name = line.description.trim();
    if (!name) continue;
    const key = matchNameKey(name);
    const material = materials.find(
      (row) => matchNameKey(row.name) === key || matchNameKey(row.sku) === key
    );
    const finished = products.find(
      (row) => matchNameKey(row.name) === key || matchNameKey(row.sku) === key
    );
    if (!material && finished) continue;

    const sku = material?.sku || `IRS-${key.replace(/\s+/g, "-").slice(0, 24) || index}`;
    const materialName = material?.name || name;
    const unit = line.unit.trim() || material?.unit || "kg";
    const quantity = parseQuantityLabel(line.quantityLabel) || 1;
    const unitPrice = material?.unitCost ?? 0;
    const skuKey = matchNameKey(sku);
    const nameKey = matchNameKey(materialName);

    const already = working.find(
      (row) =>
        (row.sourceNote?.includes(note.noteNo.trim()) || row.sourceNote === sourceNote) &&
        (matchNameKey(row.sku) === skuKey || matchNameKey(row.materialName) === nameKey)
    );
    if (already) {
      if (already.status === "warehoused" || already.status === "returned") continue;
      const next: RawMaterialOrder = {
        ...already,
        supplier: note.party || already.supplier,
        quantity,
        unit,
        totalPrice: quantity * already.unitPrice,
        invoiceNo: note.relatedInvoiceNo || already.invoiceNo,
        targetWarehouseId: already.targetWarehouseId || targetWarehouseId,
      };
      await dbSaveRawMaterialOrder(next, ctx);
      queued += 1;
      continue;
    }

    const open = working.find(
      (row) =>
        (row.status === "to_order" || row.status === "ordered" || row.status === "received") &&
        (matchNameKey(row.sku) === skuKey || matchNameKey(row.materialName) === nameKey)
    );
    const lotNo = `LOT-${sku}-${today.replace(/-/g, "")}`;
    if (open) {
      const next: RawMaterialOrder = {
        ...open,
        status: "qc_pending",
        supplier: note.party || open.supplier,
        quantity: quantity || open.quantity,
        unit,
        totalPrice: (quantity || open.quantity) * open.unitPrice,
        receivedDate: today,
        qcStartedAt: today,
        qcAnalyst: open.qcAnalyst ?? "Depo KK",
        lotNo: open.lotNo || lotNo,
        invoiceNo: note.relatedInvoiceNo || open.invoiceNo,
        sourceNote,
        targetWarehouseId: open.targetWarehouseId || targetWarehouseId,
      };
      await dbSaveRawMaterialOrder(next, ctx);
      Object.assign(open, next);
      queued += 1;
      continue;
    }

    const created: RawMaterialOrder = {
      id: `rmo-irs-${Date.now()}-${index}`,
      orderNo: nextHmOrderNo(working),
      materialName,
      sku,
      supplier: note.party,
      quantity,
      unit,
      unitPrice,
      totalPrice: quantity * unitPrice,
      status: "qc_pending",
      source: "delivery_note",
      sourceNote,
      targetWarehouseId,
      orderDate: note.issueDate || today,
      expectedDelivery: note.shipDate,
      receivedDate: today,
      qcStartedAt: today,
      lotNo,
      invoiceNo: note.relatedInvoiceNo || undefined,
      qcAnalyst: "Depo KK",
    };
    await dbSaveRawMaterialOrder(created, ctx);
    working.push(created);
    queued += 1;
  }

  return queued;
}

const transitions: Record<
  RawMaterialOrderStatus,
  Partial<Record<RawMaterialOrderAction, RawMaterialOrderStatus>>
> = {
  to_order: { place_order: "ordered" },
  ordered: { mark_received: "received" },
  received: { start_qc: "qc_pending" },
  qc_pending: { approve_qc: "warehoused", reject_qc: "qc_failed" },
  qc_failed: { complete_return: "returned" },
  warehoused: {},
  returned: {},
};

export async function dbApplyRawMaterialOrderAction(
  orderId: string,
  action: RawMaterialOrderAction,
  ctx: AuditCtx
): Promise<RawMaterialOrder> {
  const order = await dbGetRawMaterialOrder(orderId);
  if (!order) throw new Error("Sipariş bulunamadı");

  const next = transitions[order.status]?.[action];
  if (!next) throw new Error("Bu işlem mevcut durumda yapılamaz");

  const today = todayIso();
  const updated: RawMaterialOrder = { ...order, status: next };

  switch (action) {
    case "place_order":
      updated.invoiceNo = updated.invoiceNo ?? `FTR-${Date.now().toString().slice(-8)}`;
      break;
    case "mark_received":
      updated.receivedDate = today;
      if (!updated.lotNo) {
        updated.lotNo = `LOT-${order.sku}-${today.replace(/-/g, "")}`;
      }
      break;
    case "start_qc":
      updated.qcStartedAt = today;
      updated.qcAnalyst = updated.qcAnalyst ?? "Uzm. Lab. Atanmadı";
      break;
    case "approve_qc":
      updated.qcCompletedAt = today;
      updated.warehousedAt = today;
      updated.qcNotes =
        updated.qcNotes ?? "Kalite kontrol spesifikasyon dahilinde — depo girişi onaylandı";
      {
        const material = await dbGetRawMaterialBySku(order.sku);
        await dbCreateStockEntry(
          {
            sku: order.sku,
            name: order.materialName,
            category: material?.category ?? "Ham Madde",
            warehouseId: order.targetWarehouseId ?? WAREHOUSE_IDS.production,
            quantity: order.quantity,
            unit: order.unit,
            minStock: Math.max(1, Math.round(order.quantity * 0.2)),
            lotNo: updated.lotNo ?? `LOT-${order.sku}-${today.replace(/-/g, "")}`,
            expiryDate: plusYearsIso(2),
          },
          ctx
        );
      }
      break;
    case "reject_qc":
      updated.qcCompletedAt = today;
      updated.qcNotes =
        updated.qcNotes ?? "Kalite kontrol spesifikasyon dışı — iade süreci başlatıldı";
      break;
    case "complete_return":
      updated.returnedAt = today;
      break;
  }

  await dbSaveRawMaterialOrder(updated, ctx);
  await logAudit({
    actor: ctx.actor,
    action: "ACTION",
    entityType: "RawMaterialOrder",
    entityId: orderId,
    summary: `Hammadde siparişi akış adımı: ${action} → ${next}`,
    before: order,
    after: updated,
    ipAddress: ctx.ip,
  });
  return updated;
}

// ─── Production ─────────────────────────────────────────────────────────────

function parseMaterialUsage(json: string | null | undefined): BatchMaterialUsage[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const rows: BatchMaterialUsage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const materialName = String(rec.materialName ?? "").trim();
      if (!materialName) continue;
      const actualRaw = rec.actual;
      rows.push({
        materialId: String(rec.materialId ?? ""),
        materialName,
        unit: String(rec.unit ?? ""),
        estimated: asNumber(rec.estimated),
        actual:
          actualRaw === null || actualRaw === undefined || actualRaw === ""
            ? null
            : asNumber(actualRaw),
      });
    }
    return rows;
  } catch {
    return undefined;
  }
}

function mapProductionBatch(row: {
  id: string;
  batchNo: string;
  product: string;
  line: string;
  status: string;
  queuePosition: number | null;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  yield: number;
  qcScore: number;
  materialUsage?: string | null;
}): ProductionBatch {
  return {
    id: row.id,
    batchNo: row.batchNo,
    product: row.product,
    line: row.line,
    status: row.status as ProductionBatch["status"],
    queuePosition: row.queuePosition,
    quantity: asNumber(row.quantity),
    unit: row.unit,
    startDate: row.startDate,
    endDate: row.endDate,
    yield: asNumber(row.yield),
    qcScore: asNumber(row.qcScore),
    materialUsage: parseMaterialUsage(row.materialUsage),
  };
}

export async function dbGetAllProductionBatches(): Promise<ProductionBatch[]> {
  const rows = await prisma.productionBatch.findMany({
    orderBy: { startDate: "desc" },
  });
  return rows.map(mapProductionBatch);
}

async function lineHasActiveBatch(lineName: string): Promise<boolean> {
  const count = await prisma.productionBatch.count({
    where: { line: lineName, status: "in_progress" },
  });
  return count > 0;
}

async function nextQueuePosition(lineName: string): Promise<number> {
  const queued = await prisma.productionBatch.findMany({
    where: { line: lineName, status: "queued" },
    select: { queuePosition: true },
  });
  const max = queued.reduce((m, row) => Math.max(m, row.queuePosition ?? 0), 0);
  return max + 1;
}

async function reindexQueue(lineName: string): Promise<void> {
  const queued = await prisma.productionBatch.findMany({
    where: { line: lineName, status: "queued" },
    orderBy: [{ queuePosition: "asc" }, { startDate: "asc" }],
  });
  await prisma.$transaction(
    queued.map((row, index) =>
      prisma.productionBatch.update({
        where: { id: row.id },
        data: { queuePosition: index + 1 },
      })
    )
  );
}

async function assignBatchToLine(
  batch: ProductionBatch,
  ctx: AuditCtx
): Promise<void> {
  const line = (await dbGetAllProductionLines()).find((l) => l.name === batch.line);
  if (!line) return;
  await dbUpdateProductionLine(
    line.id,
    {
      product: batch.product,
      currentBatch: batch.batchNo,
      status: line.status === "idle" ? "active" : line.status,
    },
    ctx
  );
}

async function promoteNextQueued(
  lineName: string,
  ctx: AuditCtx
): Promise<ProductionBatch | null> {
  const next = await prisma.productionBatch.findFirst({
    where: { line: lineName, status: "queued" },
    orderBy: [{ queuePosition: "asc" }, { startDate: "asc" }],
  });
  if (!next) return null;
  const updated = await prisma.productionBatch.update({
    where: { id: next.id },
    data: { status: "in_progress", queuePosition: null },
  });
  await reindexQueue(lineName);
  const mapped = mapProductionBatch(updated);
  await assignBatchToLine(mapped, ctx);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "ProductionBatch",
    entityId: mapped.id,
    summary: `Sıradaki parti başlatıldı: ${mapped.batchNo}`,
    before: mapProductionBatch(next),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbGetAllProductionLines(): Promise<ProductionLine[]> {
  const rows = await prisma.productionLine.findMany();
  return rows.map((r) => ({
    ...r,
    code: r.code ?? undefined,
  })) as ProductionLine[];
}

export async function dbUpdateProductionLine(
  id: string,
  patch: unknown,
  ctx: AuditCtx
): Promise<ProductionLine | undefined> {
  const line = (await dbGetAllProductionLines()).find((l) => l.id === id);
  if (!line) return undefined;

  const body = asRecord(patch);
  const product =
    asString(body.product, "product", { optional: true }) ?? line.product;
  const status =
    asEnum(body.status, LINE_STATUSES, "status", { optional: true }) ??
    line.status;
  const efficiency =
    asFiniteNumber(body.efficiency, "efficiency", {
      min: 0,
      max: 100,
      optional: true,
    }) ?? line.efficiency;
  const currentBatch =
    asString(body.currentBatch, "currentBatch", { optional: true }) ??
    line.currentBatch;
  const outputToday =
    asFiniteNumber(body.outputToday, "outputToday", {
      min: 0,
      optional: true,
    }) ?? line.outputToday;
  const targetToday =
    asFiniteNumber(body.targetToday, "targetToday", {
      min: 0,
      optional: true,
    }) ?? line.targetToday;
  const operator =
    asString(body.operator, "operator", { optional: true }) ?? line.operator;
  const lastMaintenance =
    asString(body.lastMaintenance, "lastMaintenance", { optional: true }) ??
    line.lastMaintenance;

  const next: ProductionLine = {
    id: line.id,
    code: line.code,
    name: line.name,
    product,
    status,
    efficiency,
    currentBatch,
    outputToday,
    targetToday,
    operator,
    lastMaintenance,
  };
  await prisma.productionLine.update({
    where: { id },
    data: {
      code: next.code ?? null,
      name: next.name,
      product: next.product,
      status: next.status,
      efficiency: next.efficiency,
      currentBatch: next.currentBatch,
      outputToday: next.outputToday,
      targetToday: next.targetToday,
      operator: next.operator,
      lastMaintenance: next.lastMaintenance,
    },
  });
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "ProductionLine",
    entityId: id,
    summary: `Üretim hattı güncellendi: ${next.name}`,
    before: line,
    after: next,
    ipAddress: ctx.ip,
  });
  return next;
}

function prefixForLine(lineName: string): string {
  const n = lineName.toLocaleLowerCase("tr");
  if (n.includes("şurup")) return "SR";
  if (n.includes("enjeksiyon") || n.includes("steril")) return "INJ";
  if (n.includes("kapsül")) return "CAP";
  return "BT";
}

export async function dbNextBatchNo(lineName: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = prefixForLine(lineName);
  let max = 0;
  for (const b of await dbGetAllProductionBatches()) {
    const match = b.batchNo.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function buildBatchMaterialUsage(
  product: string,
  quantity: number
): Promise<BatchMaterialUsage[]> {
  const recipes = await dbGetAllRecipes();
  const recipe = findRecipeByProductName(recipes, product);
  if (!recipe) {
    throw new FieldError("Bu ürün için reçete yok");
  }
  const materials = await dbGetAllRawMaterials();
  return estimateRecipeMaterials(recipe, quantity, materials);
}

function applyQcActuals(
  estimated: BatchMaterialUsage[],
  actuals: BatchMaterialUsage[] | undefined
): BatchMaterialUsage[] {
  if (estimated.length === 0) return [];
  if (!actuals?.length) {
    throw new FieldError("KK için gerçekleşen hammadde miktarlarını girin");
  }
  return estimated.map((est) => {
    const hit =
      actuals.find(
        (a) =>
          matchNameKey(a.materialName) === matchNameKey(est.materialName) &&
          matchNameKey(a.unit) === matchNameKey(est.unit)
      ) ??
      actuals.find(
        (a) => matchNameKey(a.materialName) === matchNameKey(est.materialName)
      );
    if (!hit || hit.actual === null || !Number.isFinite(hit.actual) || hit.actual < 0) {
      throw new FieldError(`Gerçekleşen miktar girin: ${est.materialName}`);
    }
    return { ...est, actual: hit.actual };
  });
}

async function deductBatchMaterials(
  tx: Prisma.TransactionClient,
  usage: BatchMaterialUsage[]
): Promise<void> {
  const warehouse = getWarehouseName(WAREHOUSE_IDS.production);
  for (const line of usage) {
    const qty = line.actual ?? 0;
    if (!(qty > 0)) continue;
    await deductStockForShipment(tx, {
      product: line.materialName,
      quantity: qty,
      unit: line.unit,
      warehouse,
      kind: "material",
    });
  }
}

export async function dbCreateProductionBatch(
  input: CreateBatchInput,
  ctx: AuditCtx
): Promise<ProductionBatch> {
  const batchNo = input.batchNo?.trim() || (await dbNextBatchNo(input.line));
  const all = await dbGetAllProductionBatches();
  if (all.some((b) => b.batchNo.toLowerCase() === batchNo.toLowerCase())) {
    throw new Error("Bu batch numarası zaten kayıtlı");
  }

  const busy = await lineHasActiveBatch(input.line);
  let status = input.status;
  let queuePosition: number | null = null;
  if (input.status === "queued" || (input.status === "in_progress" && busy)) {
    status = "queued";
    queuePosition = await nextQueuePosition(input.line);
  }

  const materialUsage = await buildBatchMaterialUsage(
    input.product.trim(),
    input.quantity
  );

  const batch: ProductionBatch = {
    id: `b-${Date.now()}`,
    batchNo,
    product: input.product.trim(),
    line: input.line,
    status,
    queuePosition,
    quantity: input.quantity,
    unit: input.unit,
    startDate: input.startDate,
    endDate: input.endDate,
    yield: input.yield,
    qcScore: input.qcScore,
    materialUsage,
  };
  await prisma.productionBatch.create({
    data: {
      id: batch.id,
      batchNo: batch.batchNo,
      product: batch.product,
      line: batch.line,
      status: batch.status,
      queuePosition: batch.queuePosition,
      quantity: batch.quantity,
      unit: batch.unit,
      startDate: batch.startDate,
      endDate: batch.endDate,
      yield: batch.yield,
      qcScore: batch.qcScore,
      materialUsage: JSON.stringify(materialUsage),
    },
  });

  if (batch.status === "in_progress") {
    await assignBatchToLine(batch, ctx);
  }

  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "ProductionBatch",
    entityId: batch.id,
    summary:
      batch.status === "queued"
        ? `Üretim partisi sıraya alındı: ${batch.batchNo} (${batch.queuePosition}. sıra)`
        : `Üretim partisi oluşturuldu: ${batch.batchNo}`,
    after: batch,
    ipAddress: ctx.ip,
  });
  if (batch.status === "completed") {
    await prisma.$transaction(async (tx) => {
      await addProducedGoodsStock(tx, batch);
    });
    await enqueueShipmentForCompletedBatch(batch, ctx);
  }
  return batch;
}

const FINISHED_BATCH_STATUSES = new Set(["qc_pending", "completed", "rejected"]);

export async function dbUpdateProductionBatch(
  id: string,
  input: {
    action?: "complete_and_next" | "start_next" | "approve_qc" | "reject_qc";
    patch?: { status?: ProductionBatch["status"] };
    materialUsage?: BatchMaterialUsage[];
  },
  ctx: AuditCtx
): Promise<ProductionBatch> {
  const beforeRow = await prisma.productionBatch.findUnique({ where: { id } });
  if (!beforeRow) throw new FieldError("Parti bulunamadı");
  const before = mapProductionBatch(beforeRow);

  if (input.action === "approve_qc" || input.action === "reject_qc") {
    if (before.status !== "qc_pending") {
      throw new FieldError(
        "Yalnızca KK bekleyen parti onaylanabilir veya reddedilebilir"
      );
    }
    const status = input.action === "approve_qc" ? "completed" : "rejected";
    let usage = before.materialUsage;
    if (input.action === "approve_qc") {
      if (!usage?.length) {
        try {
          usage = await buildBatchMaterialUsage(before.product, before.quantity);
        } catch {
          usage = [];
        }
      }
      usage = applyQcActuals(usage, input.materialUsage);
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (input.action === "approve_qc") {
        if (usage?.length) await deductBatchMaterials(tx, usage);
        await addProducedGoodsStock(tx, before);
      }
      return tx.productionBatch.update({
        where: { id },
        data: {
          status,
          queuePosition: null,
          materialUsage: usage ? JSON.stringify(usage) : beforeRow.materialUsage,
        },
      });
    });
    const mapped = mapProductionBatch(updated);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "ProductionBatch",
      entityId: id,
      summary:
        input.action === "approve_qc"
          ? `KK onaylandı: ${mapped.batchNo}`
          : `KK reddedildi: ${mapped.batchNo}`,
      before,
      after: mapped,
      ipAddress: ctx.ip,
    });
    if (input.action === "approve_qc") {
      await enqueueShipmentForCompletedBatch(mapped, ctx);
    }
    return mapped;
  }

  if (input.action === "start_next") {
    if (await lineHasActiveBatch(before.line)) {
      throw new FieldError("Hat meşgul; önce mevcut batch’i bitirin");
    }
    const started = await promoteNextQueued(before.line, ctx);
    if (!started) throw new FieldError("Bu hatta sırada parti yok");
    return started;
  }

  if (input.action === "complete_and_next") {
    if (before.status !== "in_progress") {
      throw new FieldError("Yalnızca üretimdeki parti bitirilebilir");
    }
    const updated = await prisma.productionBatch.update({
      where: { id },
      data: { status: "qc_pending", queuePosition: null },
    });
    const mapped = mapProductionBatch(updated);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "ProductionBatch",
      entityId: id,
      summary: `Parti bitirildi: ${mapped.batchNo}`,
      before,
      after: mapped,
      ipAddress: ctx.ip,
    });
    const next = await promoteNextQueued(before.line, ctx);
    if (!next) {
      const line = (await dbGetAllProductionLines()).find((l) => l.name === before.line);
      if (line) {
        await dbUpdateProductionLine(
          line.id,
          { currentBatch: "-", status: line.status === "active" ? "idle" : line.status },
          ctx
        );
      }
    }
    return next ?? mapped;
  }

  let nextStatus = input.patch?.status;
  if (!nextStatus) throw new FieldError("Güncellenecek alan belirtilmedi");

  if (nextStatus === "in_progress" && before.status !== "in_progress") {
    if (await lineHasActiveBatch(before.line)) {
      nextStatus = "queued";
    }
  }

  const data: { status: string; queuePosition?: number | null } = { status: nextStatus };
  if (nextStatus !== "queued") data.queuePosition = null;
  if (nextStatus === "queued") {
    data.queuePosition = await nextQueuePosition(before.line);
  }

  const updated = await prisma.productionBatch.update({
    where: { id },
    data,
  });
  const mapped = mapProductionBatch(updated);

  if (nextStatus === "in_progress") {
    await assignBatchToLine(mapped, ctx);
    if (before.status === "queued") await reindexQueue(before.line);
  }

  if (
    before.status === "in_progress" &&
    FINISHED_BATCH_STATUSES.has(nextStatus)
  ) {
    const next = await promoteNextQueued(before.line, ctx);
    if (!next) {
      const line = (await dbGetAllProductionLines()).find((l) => l.name === before.line);
      if (line) {
        await dbUpdateProductionLine(
          line.id,
          { currentBatch: "-", status: line.status === "active" ? "idle" : line.status },
          ctx
        );
      }
    }
  }

  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "ProductionBatch",
    entityId: id,
    summary: `Parti güncellendi: ${mapped.batchNo}`,
    before,
    after: mapped,
    ipAddress: ctx.ip,
  });
  if (nextStatus === "completed") {
    await enqueueShipmentForCompletedBatch(mapped, ctx);
  }
  return mapped;
}

// ─── Lab ────────────────────────────────────────────────────────────────────

function parseExperimentUsages(raw: string | null | undefined): LabExperimentMaterialUsage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LabExperimentMaterialUsage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toLabExperiment(row: {
  id: string;
  code: string;
  title: string;
  researcher: string;
  department: string;
  status: string;
  startDate: string;
  dueDate: string;
  progress: number;
  samples: number;
  priority: string;
  productName?: string | null;
  recipeCode?: string | null;
  materialUsages?: string | null;
  recipeId?: string | null;
  completionNote?: string | null;
}): LabExperiment {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    researcher: row.researcher,
    department: row.department,
    status: row.status as LabExperiment["status"],
    startDate: row.startDate,
    dueDate: row.dueDate,
    progress: row.progress,
    samples: row.samples,
    priority: row.priority as LabExperiment["priority"],
    productName: row.productName || row.title,
    recipeCode: row.recipeCode || undefined,
    materialUsages: parseExperimentUsages(row.materialUsages),
    recipeId: row.recipeId ?? undefined,
    completionNote: row.completionNote ?? undefined,
  };
}

export async function dbGetAllLabExperiments(): Promise<LabExperiment[]> {
  const rows = await prisma.labExperiment.findMany({
    orderBy: { startDate: "desc" },
  });
  return rows.map(toLabExperiment);
}

export async function dbGetLabExperiment(
  id: string
): Promise<LabExperiment | undefined> {
  const row = await prisma.labExperiment.findUnique({ where: { id } });
  return row ? toLabExperiment(row) : undefined;
}

export async function dbGetAllLabSamples(): Promise<LabSample[]> {
  const rows = await prisma.labSample.findMany({
    orderBy: { receivedDate: "desc" },
  });
  return rows.map((r) => toLabSample(r));
}

function toLabSample(r: {
  id: string;
  sampleNo: string;
  product: string;
  batchNo: string;
  type: string;
  status: string;
  receivedDate: string;
  analyst: string;
  result: string | null;
  quantity: number | null;
  unit: string | null;
  stockItemId: string | null;
  sourceKind?: string | null;
  disposition?: string | null;
}): LabSample {
  return {
    id: r.id,
    sampleNo: r.sampleNo,
    product: r.product,
    batchNo: r.batchNo,
    type: r.type,
    status: r.status as LabSample["status"],
    receivedDate: r.receivedDate,
    analyst: r.analyst,
    result: r.result ?? undefined,
    quantity: r.quantity ?? undefined,
    unit: r.unit ?? undefined,
    stockItemId: r.stockItemId ?? undefined,
    sourceKind: r.sourceKind === "material" ? "material" : "product",
    disposition:
      r.disposition === "returned" || r.disposition === "scrap"
        ? r.disposition
        : "open",
  };
}

export async function dbGetLabPeople(role: LabPersonRole): Promise<string[]> {
  const personnel = await prisma.personnel.findMany({
    select: { firstName: true, lastName: true, department: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return selectItemValues(
    personnel
      .filter((p) => matchesLabPersonnelDepartment(p.department, role))
      .map((p) => personnelDisplayName(p))
  ).sort((a, b) => a.localeCompare(b, "tr"));
}

export async function dbNextExperimentCode(): Promise<string> {
  const year = new Date().getFullYear();
  let max = 0;
  for (const e of await dbGetAllLabExperiments()) {
    const match = e.code.match(new RegExp(`^EXP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EXP-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function dbNextSampleNo(): Promise<string> {
  const year = new Date().getFullYear();
  let max = 0;
  for (const s of await dbGetAllLabSamples()) {
    const match = s.sampleNo.match(new RegExp(`^SMP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `SMP-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function dbCreateLabExperiment(
  input: CreateExperimentInput,
  ctx: AuditCtx
): Promise<LabExperiment> {
  const code = input.code?.trim() || (await dbNextExperimentCode());
  const all = await dbGetAllLabExperiments();
  if (all.some((e) => e.code.toLowerCase() === code.toLowerCase())) {
    throw new Error("Bu deney kodu zaten kayıtlı");
  }
  const productName = input.productName.trim();
  const recipeCode = input.recipeCode.trim();
  if (!productName || !recipeCode) {
    throw new FieldError("Ürün adı ve reçete kodu zorunludur");
  }
  if (!input.materials?.length) {
    throw new FieldError("En az bir hammadde seçin");
  }

  const startDate = input.startDate || todayIso();
  const dueDate = input.dueDate || plusDaysIso(45);
  const usages: LabExperimentMaterialUsage[] = [];
  const stockById = new Map<string, number>();

  for (const line of input.materials) {
    const qty = line.quantity;
    if (!(qty > 0)) continue;
    const prev = stockById.get(line.stockItemId) ?? 0;
    stockById.set(line.stockItemId, prev + qty);
  }
  if (stockById.size === 0) {
    throw new FieldError("En az bir hammadde miktarı girin");
  }

  const experimentId = `e-${Date.now()}`;
  await prisma.$transaction(async (tx) => {
    for (const [stockItemId, quantity] of stockById) {
      const item = await tx.warehouseStockItem.findUnique({
        where: { id: stockItemId },
      });
      if (!item) throw new FieldError("Stok kalemi bulunamadı");
      if (isMamulStockCategory(item.category)) {
        throw new FieldError("Deney için hammadde stoku seçin");
      }
      if (quantity > item.quantity) {
        throw new FieldError(
          `Yetersiz stok: ${item.name} · ${item.quantity} ${item.unit} kaldı`
        );
      }
      const remaining = item.quantity - quantity;
      await tx.warehouseStockItem.update({
        where: { id: item.id },
        data: {
          quantity: remaining,
          status: deriveStockStatus(remaining, item.minStock, item.expiryDate),
        },
      });
      usages.push({
        id: `emu-${Date.now()}-${usages.length}`,
        stockItemId: item.id,
        materialName: item.name,
        sku: item.sku,
        lotNo: item.lotNo,
        quantity,
        unit: item.unit,
        reason: "Başlangıç formülasyonu",
        addedAt: todayIso(),
        kind: "initial",
      });
    }

    await tx.labExperiment.create({
      data: {
        id: experimentId,
        code,
        title: productName,
        researcher: input.researcher.trim(),
        department: input.department?.trim() || "Ar-Ge",
        status: "running",
        startDate,
        dueDate,
        progress: 10,
        samples: 0,
        priority: input.priority ?? "normal",
        productName,
        recipeCode,
        materialUsages: JSON.stringify(usages),
      },
    });
  });

  const experiment = await dbGetLabExperiment(experimentId);
  if (!experiment) throw new Error("Deney oluşturulamadı");
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "LabExperiment",
    entityId: experiment.id,
    summary: `Deney başlatıldı: ${experiment.code} · ${productName} / ${recipeCode} · ${usages.length} hammadde stoktan düşüldü`,
    after: experiment,
    ipAddress: ctx.ip,
  });
  return experiment;
}

export async function dbAddExperimentMaterial(
  id: string,
  input: { stockItemId: string; quantity: number; reason: string },
  ctx: AuditCtx
): Promise<LabExperiment> {
  const raw = await prisma.labExperiment.findUnique({ where: { id } });
  if (!raw) throw new FieldError("Deney bulunamadı");
  const before = toLabExperiment(raw);
  if (before.status === "approved") {
    throw new FieldError("Tamamlanan deneye hammadde eklenemez");
  }
  const reason = input.reason.trim();
  if (!reason) throw new FieldError("Ekleme sebebi zorunludur");
  const quantity = input.quantity;
  if (!(quantity > 0)) throw new FieldError("Miktar pozitif olmalıdır");

  const row = await prisma.$transaction(async (tx) => {
    const item = await tx.warehouseStockItem.findUnique({
      where: { id: input.stockItemId.trim() },
    });
    if (!item) throw new FieldError("Stok kalemi bulunamadı");
    if (isMamulStockCategory(item.category)) {
      throw new FieldError("Hammadde stoku seçin");
    }
    if (quantity > item.quantity) {
      throw new FieldError(
        `Yetersiz stok: ${item.name} · ${item.quantity} ${item.unit} kaldı`
      );
    }
    const remaining = item.quantity - quantity;
    await tx.warehouseStockItem.update({
      where: { id: item.id },
      data: {
        quantity: remaining,
        status: deriveStockStatus(remaining, item.minStock, item.expiryDate),
      },
    });
    const usages = [...(before.materialUsages ?? [])];
    usages.push({
      id: `emu-${Date.now()}`,
      stockItemId: item.id,
      materialName: item.name,
      sku: item.sku,
      lotNo: item.lotNo,
      quantity,
      unit: item.unit,
      reason,
      addedAt: todayIso(),
      kind: "extra",
    });
    return tx.labExperiment.update({
      where: { id },
      data: {
        materialUsages: JSON.stringify(usages),
        status: before.status === "planning" ? "running" : before.status,
        progress: Math.max(before.progress, 30),
      },
    });
  });

  const after = toLabExperiment(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "LabExperiment",
    entityId: id,
    summary: `Deneye hammadde eklendi: ${after.code} · ${input.quantity} (${reason})`,
    before,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

export async function dbCompleteLabExperiment(
  id: string,
  input: { completionNote?: string },
  ctx: AuditCtx
): Promise<LabExperiment> {
  const raw = await prisma.labExperiment.findUnique({ where: { id } });
  if (!raw) throw new FieldError("Deney bulunamadı");
  const before = toLabExperiment(raw);
  if (before.status === "approved" && before.recipeId) {
    throw new FieldError("Bu deney zaten tamamlandı");
  }
  const usages = before.materialUsages ?? [];
  if (usages.length === 0) {
    throw new FieldError("Reçete oluşturmak için hammadde kullanımı yok");
  }

  const totals = new Map<
    string,
    { materialName: string; unit: string; quantity: number }
  >();
  for (const u of usages) {
    const key = `${matchNameKey(u.materialName)}|${u.unit}`;
    const prev = totals.get(key);
    if (prev) prev.quantity += u.quantity;
    else {
      totals.set(key, {
        materialName: u.materialName,
        unit: u.unit,
        quantity: u.quantity,
      });
    }
  }

  let recipeCode = before.recipeCode?.trim() || "";
  const existingRecipes = await dbGetAllRecipes();
  if (
    !recipeCode ||
    existingRecipes.some(
      (r) => (r.code ?? "").toLowerCase() === recipeCode.toLowerCase()
    )
  ) {
    recipeCode = await dbNextRecipeCode();
  }

  const recipe = await dbCreateRecipe(
    {
      code: recipeCode,
      productName: before.productName || before.title,
      lines: [...totals.values()].map((t) => ({
        materialName: t.materialName,
        unit: t.unit,
        quantityPerUnit: t.quantity,
      })),
    },
    ctx
  );

  const row = await prisma.labExperiment.update({
    where: { id },
    data: {
      status: "approved",
      progress: 100,
      recipeId: recipe.id,
      recipeCode: recipe.code ?? recipeCode,
      completionNote: input.completionNote?.trim() || null,
    },
  });
  const after = toLabExperiment(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "LabExperiment",
    entityId: id,
    summary: `Deney tamamlandı: ${after.code} → reçete ${recipe.code} oluşturuldu`,
    before,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

function isMamulStockCategory(category: string) {
  return stockNorm(category) === "mamul";
}

export async function dbCreateLabSample(
  input: CreateSampleInput,
  ctx: AuditCtx
): Promise<LabSample> {
  const sampleNo = input.sampleNo?.trim() || (await dbNextSampleNo());
  const all = await dbGetAllLabSamples();
  if (all.some((s) => s.sampleNo.toLowerCase() === sampleNo.toLowerCase())) {
    throw new Error("Bu numune numarası zaten kayıtlı");
  }
  const quantity = input.quantity;
  const stockItem = await prisma.warehouseStockItem.findUnique({
    where: { id: input.stockItemId.trim() },
  });
  if (!stockItem) throw new FieldError("Stok kalemi bulunamadı");
  const mamul = isMamulStockCategory(stockItem.category);
  if (input.sourceKind === "product" && !mamul) {
    throw new FieldError("Mamul stok kalemi seçin");
  }
  if (input.sourceKind === "material" && mamul) {
    throw new FieldError("Hammadde stok kalemi seçin");
  }
  if (quantity > stockItem.quantity) {
    throw new FieldError(
      `Yetersiz stok: ${stockItem.quantity} ${stockItem.unit} kaldı`
    );
  }

  const sample: LabSample = {
    id: `ls-${Date.now()}`,
    sampleNo,
    product: input.product?.trim() || stockItem.name,
    batchNo: input.batchNo?.trim() || stockItem.lotNo,
    type:
      input.type?.trim() ||
      (input.sourceKind === "material" ? "Hammadde Analizi" : "Üretim Numunesi"),
    status: input.status ?? "testing",
    receivedDate: input.receivedDate,
    analyst: input.analyst.trim(),
    result: input.result?.trim() || undefined,
    quantity,
    unit: input.unit?.trim() || stockItem.unit,
    stockItemId: stockItem.id,
    sourceKind: input.sourceKind,
    disposition: "open",
  };

  await prisma.$transaction(async (tx) => {
    await tx.labSample.create({
      data: {
        id: sample.id,
        sampleNo: sample.sampleNo,
        product: sample.product,
        batchNo: sample.batchNo,
        type: sample.type,
        status: sample.status,
        receivedDate: sample.receivedDate,
        analyst: sample.analyst,
        result: sample.result ?? null,
        quantity: sample.quantity ?? null,
        unit: sample.unit ?? null,
        stockItemId: sample.stockItemId ?? null,
        sourceKind: sample.sourceKind,
        disposition: sample.disposition,
      },
    });
    const remaining = stockItem.quantity - quantity;
    await tx.warehouseStockItem.update({
      where: { id: stockItem.id },
      data: {
        quantity: remaining,
        status: deriveStockStatus(
          remaining,
          stockItem.minStock,
          stockItem.expiryDate
        ),
      },
    });
  });

  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "LabSample",
    entityId: sample.id,
    summary: `Numune oluşturuldu: ${sample.sampleNo} · ${
      input.sourceKind === "material" ? "hammadde" : "mamul"
    } stoktan ${quantity} ${sample.unit} düşüldü (${stockItem.name})`,
    after: sample,
    ipAddress: ctx.ip,
  });
  return sample;
}

export async function dbCompleteLabSample(
  id: string,
  input: { disposition: "returned" | "scrap"; result?: string },
  ctx: AuditCtx
): Promise<LabSample> {
  const raw = await prisma.labSample.findUnique({ where: { id } });
  if (!raw) throw new FieldError("Numune bulunamadı");
  const before = toLabSample(raw);
  if (before.disposition && before.disposition !== "open") {
    throw new FieldError("Bu numune zaten tamamlandı");
  }
  const quantity = before.quantity ?? 0;
  const result = input.result?.trim() || before.result;

  const row = await prisma.$transaction(async (tx) => {
    if (input.disposition === "returned") {
      if (!before.stockItemId || quantity <= 0) {
        throw new FieldError("İade için stok kalemi ve miktar gerekli");
      }
      const item = await tx.warehouseStockItem.findUnique({
        where: { id: before.stockItemId },
      });
      if (!item) throw new FieldError("İade stoğu bulunamadı");
      const nextQty = item.quantity + quantity;
      await tx.warehouseStockItem.update({
        where: { id: item.id },
        data: {
          quantity: nextQty,
          status: deriveStockStatus(nextQty, item.minStock, item.expiryDate),
        },
      });
    }
    return tx.labSample.update({
      where: { id },
      data: {
        disposition: input.disposition,
        status: input.disposition === "returned" ? "approved" : "rejected",
        result: result ?? null,
      },
    });
  });

  const after = toLabSample(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "LabSample",
    entityId: id,
    summary:
      input.disposition === "returned"
        ? `Numune depoya iade: ${after.sampleNo} · ${quantity} ${after.unit ?? ""}`
        : `Numune ıskarta: ${after.sampleNo} · ${quantity} ${after.unit ?? ""}`,
    before,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

// ─── Catalog (read-only) ────────────────────────────────────────────────────

export async function dbGetCustomers(): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  return rows.map(toCustomer);
}

export async function dbGetSuppliers(): Promise<Supplier[]> {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return rows.map(toSupplier);
}

export async function dbGetPersonnel(): Promise<Personnel[]> {
  const rows = await prisma.personnel.findMany();
  return rows.map((row) => ({
    ...row,
    salary: asNumber(row.salary),
  }));
}

export async function dbGetProducts(): Promise<FinishedProduct[]> {
  const rows = await prisma.warehouseStockItem.findMany({
    orderBy: [{ name: "asc" }, { lotNo: "asc" }],
  });
  return rows
    .filter((row) => matchNameKey(row.category) === "mamul" && row.quantity > 0)
    .map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      minStock: row.minStock,
      maxStock: row.maxStock ?? 0,
      lotNo: row.lotNo,
      expiryDate: row.expiryDate,
      quantity: row.quantity,
      warehouse: getWarehouseName(row.warehouseId),
      status: row.status,
    }));
}

export async function dbGetInvoices(): Promise<Invoice[]> {
  const rows = await prisma.invoice.findMany({ orderBy: { issueDate: "desc" } });
  return rows.map(toInvoice);
}

export async function dbGetInvoiceLines(): Promise<InvoiceLine[]> {
  const rows = await prisma.invoiceLine.findMany();
  return rows.map(toInvoiceLine);
}

export async function dbGetDeliveryNotes(): Promise<DeliveryNote[]> {
  const rows = await prisma.deliveryNote.findMany();
  return rows.map(toDeliveryNote);
}

export async function dbGetDeliveryNoteLines(): Promise<DeliveryNoteLine[]> {
  return prisma.deliveryNoteLine.findMany();
}

export async function dbGetLedger(): Promise<LedgerEntry[]> {
  const rows = await prisma.ledgerEntry.findMany();
  return rows.map((row) => ({
    ...row,
    amount: asNumber(row.amount),
  }));
}

export async function dbGetBudget(): Promise<BudgetRow[]> {
  const rows = await prisma.budgetRow.findMany();
  return rows.map((row) => ({
    ...row,
    annual: asNumber(row.annual),
    spent: asNumber(row.spent),
  }));
}

export async function dbGetWarehouses(): Promise<Warehouse[]> {
  const [rows, stock] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.warehouseStockItem.groupBy({
      by: ["warehouseId"],
      _sum: { quantity: true },
      _count: { _all: true },
    }),
  ]);
  const byId = new Map(stock.map((row) => [row.warehouseId, row]));
  return rows.map((w) => {
    const agg = byId.get(w.id);
    return {
      id: w.id,
      name: w.name,
      type: w.type as Warehouse["type"],
      description: w.description,
      location: w.location,
      capacity: w.capacity,
      used: agg?._sum.quantity ?? 0,
      temperature: w.temperature,
      humidity: w.humidity,
      manager: w.manager,
      items: agg?._count._all ?? 0,
      lastAudit: w.lastAudit,
    };
  });
}

function toStockTransfer(row: {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  sourceItemId: string;
  materialName: string;
  sku: string;
  quantity: number;
  unit: string;
  reason: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  note: string | null;
}): StockTransfer {
  return {
    id: row.id,
    fromWarehouseId: row.fromWarehouseId,
    toWarehouseId: row.toWarehouseId,
    sourceItemId: row.sourceItemId,
    materialName: row.materialName,
    sku: row.sku,
    quantity: row.quantity,
    unit: row.unit,
    reason: row.reason as StockTransfer["reason"],
    status: row.status as StockTransfer["status"],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    note: row.note ?? undefined,
  };
}

export async function dbGetStockTransfers(): Promise<StockTransfer[]> {
  const rows = await prisma.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toStockTransfer);
}

type StockItemSnapshot = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  maxStock: number | null;
  lotNo: string;
  expiryDate: string;
  temperature: string | null;
  replenishFromWarehouseId: string | null;
  labTargetQuantity: number | null;
  labDirectEntry: boolean;
};

async function creditWarehouseStock(
  tx: Prisma.TransactionClient,
  source: StockItemSnapshot,
  toWarehouseId: string,
  quantity: number
) {
  const existingDest = await tx.warehouseStockItem.findFirst({
    where: {
      warehouseId: toWarehouseId,
      sku: source.sku,
      lotNo: source.lotNo,
    },
  });
  if (existingDest) {
    const destQty = existingDest.quantity + quantity;
    await tx.warehouseStockItem.update({
      where: { id: existingDest.id },
      data: {
        quantity: destQty,
        status: deriveStockStatus(
          destQty,
          existingDest.minStock,
          existingDest.expiryDate
        ),
      },
    });
    return;
  }
  await tx.warehouseStockItem.create({
    data: {
      id: `ws-tr-${Date.now()}`,
      sku: source.sku,
      name: source.name,
      category: source.category,
      warehouseId: toWarehouseId,
      quantity,
      unit: source.unit,
      minStock: source.minStock,
      maxStock: source.maxStock,
      lotNo: source.lotNo,
      expiryDate: source.expiryDate,
      status: deriveStockStatus(quantity, source.minStock, source.expiryDate),
      temperature: source.temperature,
      replenishFromWarehouseId: source.replenishFromWarehouseId,
      labTargetQuantity: source.labTargetQuantity,
      labDirectEntry: source.labDirectEntry,
    },
  });
}

export async function dbCreateStockTransfer(
  input: {
    sourceItemId: string;
    toWarehouseId: string;
    quantity: number;
    reason: StockTransfer["reason"];
    note?: string;
  },
  ctx: AuditCtx
): Promise<StockTransfer> {
  const sourceItemId = input.sourceItemId.trim();
  const toWarehouseId = input.toWarehouseId.trim();
  const quantity = input.quantity;
  const note = input.note?.trim() || undefined;

  const transfer = await prisma.$transaction(async (tx) => {
    const source = await tx.warehouseStockItem.findUnique({
      where: { id: sourceItemId },
    });
    if (!source) {
      throw new FieldError("Kaynak stok kalemi bulunamadı");
    }
    if (source.warehouseId === toWarehouseId) {
      throw new FieldError("Kaynak ve hedef depo aynı olamaz");
    }
    const [sourceWarehouse, destWarehouse] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: source.warehouseId } }),
      tx.warehouse.findUnique({ where: { id: toWarehouseId } }),
    ]);
    if (!destWarehouse) {
      throw new FieldError("Hedef depo bulunamadı");
    }
    if (!(quantity > 0)) {
      throw new FieldError("Miktar pozitif olmalıdır");
    }
    if (quantity > source.quantity) {
      throw new FieldError("Miktar kaynak stoktan fazla olamaz");
    }

    const sourceFinished = isFinishedWarehouseType(sourceWarehouse?.type ?? "");
    const destFinished = isFinishedWarehouseType(destWarehouse.type);
    if (sourceFinished !== destFinished) {
      throw new FieldError("Hammadde ve mamul depoları arasında aktarım yapılamaz");
    }
    if (destFinished && stockNorm(source.category) !== "mamul") {
      throw new FieldError("Mamul deposuna yalnızca mamul stoğu aktarılır");
    }

    const istanbul = needsIstanbulShipment(toWarehouseId);
    const reason: StockTransfer["reason"] = destFinished
      ? istanbul
        ? "istanbul_shipment"
        : "finished_direct"
      : input.reason;

    const remaining = source.quantity - quantity;
    await tx.warehouseStockItem.update({
      where: { id: source.id },
      data: {
        quantity: remaining,
        status: deriveStockStatus(remaining, source.minStock, source.expiryDate),
      },
    });

    if (!istanbul) {
      await creditWarehouseStock(tx, source, toWarehouseId, quantity);
    }

    return tx.stockTransfer.create({
      data: {
        fromWarehouseId: source.warehouseId,
        toWarehouseId,
        sourceItemId: source.id,
        materialName: source.name,
        sku: source.sku,
        quantity,
        unit: source.unit,
        reason,
        status: istanbul ? "allocated" : "completed",
        completedAt: istanbul ? null : new Date(),
        note: note ?? null,
      },
    });
  });

  const mapped = toStockTransfer(transfer);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "StockTransfer",
    entityId: mapped.id,
    summary: needsIstanbulShipment(mapped.toWarehouseId)
      ? `İstanbul sevkiyatı ayrıldı: ${mapped.quantity} ${mapped.unit} ${mapped.materialName}`
      : `Stok aktarıldı: ${mapped.quantity} ${mapped.unit} ${mapped.materialName} (${mapped.fromWarehouseId} → ${mapped.toWarehouseId})`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbAdvanceStockTransfer(
  id: string,
  action: "approve" | "depart" | "arrive",
  ctx: AuditCtx
): Promise<StockTransfer> {
  const existing = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!existing) throw new FieldError("Aktarım bulunamadı");
  if (existing.reason !== "istanbul_shipment") {
    throw new FieldError("Bu kayıt İstanbul sevkiyatı değil");
  }
  const next = ISTANBUL_SHIPMENT_NEXT[existing.status];
  if (!next || next.action !== action) {
    throw new FieldError("Bu sevkiyat adımı şu an yapılamaz");
  }

  const status =
    action === "approve" ? "approved" : action === "depart" ? "in_transit" : "completed";

  const updated = await prisma.$transaction(async (tx) => {
    if (action === "arrive") {
      const source = await tx.warehouseStockItem.findUnique({
        where: { id: existing.sourceItemId },
      });
      const snapshot: StockItemSnapshot = source
        ? source
        : {
            sku: existing.sku,
            name: existing.materialName,
            category: "Mamul",
            unit: existing.unit,
            minStock: 0,
            maxStock: null,
            lotNo: "",
            expiryDate: "",
            temperature: null,
            replenishFromWarehouseId: null,
            labTargetQuantity: null,
            labDirectEntry: false,
          };
      await creditWarehouseStock(tx, snapshot, existing.toWarehouseId, existing.quantity);
    }
    return tx.stockTransfer.update({
      where: { id },
      data: {
        status,
        completedAt: action === "arrive" ? new Date() : existing.completedAt,
      },
    });
  });

  const mapped = toStockTransfer(updated);
  const summary =
    action === "approve"
      ? `İstanbul sevkiyatı onaylandı: ${mapped.materialName}`
      : action === "depart"
        ? `İstanbul sevkiyatı yola çıktı: ${mapped.materialName}`
        : `İstanbul deposuna geldi: ${mapped.quantity} ${mapped.unit} ${mapped.materialName}`;
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "StockTransfer",
    entityId: mapped.id,
    summary,
    before: toStockTransfer(existing),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}
