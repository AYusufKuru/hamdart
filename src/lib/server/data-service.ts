import type { Order, OrderStatus, ProductionBatch, ProductionLine, ProductionLineStatus, LabExperiment, LabSample } from "@/data/mock";
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
  LedgerEntry,
  BudgetRow,
} from "@/data/catalog";
import type { StockTransfer, Warehouse } from "@/data/warehouses";
import { WAREHOUSE_IDS } from "@/data/warehouses";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { plusYearsIso, todayIso, parseLocalDate } from "@/lib/utils";
import type { CreateRecipeInput } from "@/lib/recipe-store";
import type { CreateRawMaterialInput } from "@/lib/raw-material-store";
import type { CreateStockInput } from "@/lib/stock-store";
import type { CreateBatchInput } from "@/lib/production-store";
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
  };
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

  const all = await dbGetAllOrders();
  const year = new Date().getFullYear();
  let max = 0;
  for (const o of all) {
    const match = o.orderNo.match(/SIP-\d+-(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const order: Order = {
    id: `o-${Date.now()}`,
    orderNo: `SIP-${year}-${String(max + 1).padStart(4, "0")}`,
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
  const status =
    asEnum(body.status, RECIPE_STATUSES, "status", { optional: true }) ??
    existing.status;

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

  const recipe: Recipe = {
    id: existing.id,
    code: existing.code,
    productCode,
    orderId: existing.orderId,
    productName,
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

export async function dbCreateStockEntry(
  input: CreateStockInput,
  ctx: AuditCtx
): Promise<WarehouseStockItem> {
  const item: WarehouseStockItem = {
    id: `ws-manual-${Date.now()}`,
    sku: input.sku.trim(),
    name: input.name.trim(),
    category: input.category,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    unit: input.unit,
    minStock: input.minStock,
    lotNo: input.lotNo.trim(),
    expiryDate: input.expiryDate,
    status:
      input.status ??
      deriveStockStatus(input.quantity, input.minStock, input.expiryDate),
    temperature: input.temperature?.trim() || undefined,
    labDirectEntry: input.labDirectEntry || undefined,
    replenishFromWarehouseId: input.replenishFromWarehouseId,
    labTargetQuantity: input.labTargetQuantity,
  };
  await prisma.warehouseStockItem.create({
    data: {
      ...item,
      maxStock: null,
      temperature: item.temperature ?? null,
      replenishFromWarehouseId: item.replenishFromWarehouseId ?? null,
      labTargetQuantity: item.labTargetQuantity ?? null,
      labDirectEntry: item.labDirectEntry ?? false,
    },
  });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "WarehouseStockItem",
    entityId: item.id,
    summary: `Stok girişi: ${item.name} (${item.quantity} ${item.unit})`,
    after: item,
    ipAddress: ctx.ip,
  });
  return item;
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
  const year = new Date().getFullYear();
  const existing = await dbGetAllRawMaterialOrders();
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
  return dbSaveRawMaterialOrder(order, ctx);
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

export async function dbGetAllProductionBatches(): Promise<ProductionBatch[]> {
  const rows = await prisma.productionBatch.findMany({
    orderBy: { startDate: "desc" },
  });
  return rows as ProductionBatch[];
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

export async function dbCreateProductionBatch(
  input: CreateBatchInput,
  ctx: AuditCtx
): Promise<ProductionBatch> {
  const batchNo = input.batchNo?.trim() || (await dbNextBatchNo(input.line));
  const all = await dbGetAllProductionBatches();
  if (all.some((b) => b.batchNo.toLowerCase() === batchNo.toLowerCase())) {
    throw new Error("Bu batch numarası zaten kayıtlı");
  }
  const batch: ProductionBatch = {
    id: `b-${Date.now()}`,
    batchNo,
    product: input.product.trim(),
    line: input.line,
    status: input.status,
    quantity: input.quantity,
    unit: input.unit,
    startDate: input.startDate,
    endDate: input.endDate,
    yield: input.yield,
    qcScore: input.qcScore,
  };
  await prisma.productionBatch.create({ data: batch });

  if (input.status === "in_progress") {
    const line = (await dbGetAllProductionLines()).find((l) => l.name === input.line);
    if (line) {
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
  }

  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "ProductionBatch",
    entityId: batch.id,
    summary: `Üretim partisi oluşturuldu: ${batch.batchNo}`,
    after: batch,
    ipAddress: ctx.ip,
  });
  return batch;
}

// ─── Lab ────────────────────────────────────────────────────────────────────

export async function dbGetAllLabExperiments(): Promise<LabExperiment[]> {
  const rows = await prisma.labExperiment.findMany({
    orderBy: { startDate: "desc" },
  });
  return rows as LabExperiment[];
}

export async function dbGetAllLabSamples(): Promise<LabSample[]> {
  const rows = await prisma.labSample.findMany({
    orderBy: { receivedDate: "desc" },
  });
  return rows.map((r) => ({
    ...r,
    result: r.result ?? undefined,
  })) as LabSample[];
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
  const experiment: LabExperiment = {
    id: `e-${Date.now()}`,
    code,
    title: input.title.trim(),
    researcher: input.researcher.trim(),
    department: input.department,
    status: input.status,
    startDate: input.startDate,
    dueDate: input.dueDate,
    progress: input.progress,
    samples: input.samples,
    priority: input.priority,
  };
  await prisma.labExperiment.create({ data: experiment });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "LabExperiment",
    entityId: experiment.id,
    summary: `Deney oluşturuldu: ${experiment.code}`,
    after: experiment,
    ipAddress: ctx.ip,
  });
  return experiment;
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
  const sample: LabSample = {
    id: `ls-${Date.now()}`,
    sampleNo,
    product: input.product.trim(),
    batchNo: input.batchNo.trim(),
    type: input.type,
    status: input.status,
    receivedDate: input.receivedDate,
    analyst: input.analyst.trim(),
    result: input.result?.trim() || undefined,
  };
  await prisma.labSample.create({
    data: { ...sample, result: sample.result ?? null },
  });
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "LabSample",
    entityId: sample.id,
    summary: `Numune oluşturuldu: ${sample.sampleNo}`,
    after: sample,
    ipAddress: ctx.ip,
  });
  return sample;
}

// ─── Catalog (read-only) ────────────────────────────────────────────────────

export async function dbGetCustomers(): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    address: row.address,
    taxNo: row.taxNo,
    email: row.email,
    active: row.active,
  }));
}

export async function dbGetSuppliers(): Promise<Supplier[]> {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    address: row.address,
    active: row.active,
  }));
}

export async function dbGetPersonnel(): Promise<Personnel[]> {
  const rows = await prisma.personnel.findMany();
  return rows.map((row) => ({
    ...row,
    salary: asNumber(row.salary),
  }));
}

export async function dbGetProducts(): Promise<FinishedProduct[]> {
  return prisma.finishedProduct.findMany() as Promise<FinishedProduct[]>;
}

export async function dbGetInvoices(): Promise<Invoice[]> {
  const rows = await prisma.invoice.findMany();
  return rows.map((row) => ({
    ...row,
    amount: asNumber(row.amount),
  }));
}

export async function dbGetInvoiceLines(): Promise<InvoiceLine[]> {
  const rows = await prisma.invoiceLine.findMany();
  return rows.map((row) => ({
    ...row,
    unitPrice: asNumber(row.unitPrice),
    lineTotal: asNumber(row.lineTotal),
  }));
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
  const reason = input.reason;
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
    const destWarehouse = await tx.warehouse.findUnique({
      where: { id: toWarehouseId },
    });
    if (!destWarehouse) {
      throw new FieldError("Hedef depo bulunamadı");
    }
    if (!(quantity > 0)) {
      throw new FieldError("Miktar pozitif olmalıdır");
    }
    if (quantity > source.quantity) {
      throw new FieldError("Miktar kaynak stoktan fazla olamaz");
    }

    const remaining = source.quantity - quantity;
    await tx.warehouseStockItem.update({
      where: { id: source.id },
      data: {
        quantity: remaining,
        status: deriveStockStatus(remaining, source.minStock, source.expiryDate),
      },
    });

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
    } else {
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
        status: "completed",
        completedAt: new Date(),
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
    summary: `Stok aktarıldı: ${mapped.quantity} ${mapped.unit} ${mapped.materialName} (${mapped.fromWarehouseId} → ${mapped.toWarehouseId})`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}
