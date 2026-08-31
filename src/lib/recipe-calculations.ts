import type { Order } from "@/data/mock";
import type { RawMaterial } from "@/data/raw-materials";
import { getRawMaterialById } from "@/lib/raw-material-store";
import type { Recipe, RecipeExtra, RecipeLine } from "@/data/recipes";

export interface MaterialLineBreakdown {
  materialId: string;
  materialName: string;
  unit: string;
  quantityPerUnit: number;
  totalQuantity: number;
  unitCost: number;
  lineCost: number;
}

export interface ExtraLineBreakdown {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  reason: string;
  unitCost: number;
  lineCost: number;
}

export interface RecipeTotals {
  lines: MaterialLineBreakdown[];
  extras: ExtraLineBreakdown[];
  totalCost: number;
  totalRevenue: number | null;
  profit: number | null;
  marginPercent: number | null;
}

export function getLastOrderUnitPrice(
  productName: string,
  orders: Order[],
  excludeOrderId?: string
): number | null {
  const matches = orders
    .filter(
      (o) =>
        o.product === productName &&
        o.quantity > 0 &&
        o.value > 0 &&
        o.id !== excludeOrderId
    )
    .sort(
      (a, b) =>
        new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );

  if (matches.length === 0) return null;
  return matches[0].value / matches[0].quantity;
}

export function getOrderRevenue(order: Order): number {
  return order.value;
}

function resolveMaterial(
  id: string,
  materials?: RawMaterial[]
): RawMaterial | undefined {
  if (materials) return materials.find((m) => m.id === id);
  return getRawMaterialById(id);
}

export function calculateRecipeTotals(
  recipe: Recipe,
  orderQuantity: number,
  order: Order | null,
  allOrders: Order[],
  materials?: RawMaterial[]
): RecipeTotals {
  const lines = recipe.lines.map((line) =>
    breakdownLine(line, orderQuantity, materials)
  );
  const extras = recipe.extras.map((extra) => breakdownExtra(extra, materials));

  const totalCost =
    lines.reduce((s, l) => s + l.lineCost, 0) +
    extras.reduce((s, e) => s + e.lineCost, 0);

  const totalRevenue = order
    ? getOrderRevenue(order)
    : (() => {
        const unit = getLastOrderUnitPrice(recipe.productName, allOrders);
        return unit !== null ? unit * orderQuantity : null;
      })();

  const profit =
    totalRevenue !== null ? totalRevenue - totalCost : null;
  const marginPercent =
    profit !== null && totalRevenue !== null && totalRevenue > 0
      ? (profit / totalRevenue) * 100
      : null;

  return {
    lines,
    extras,
    totalCost,
    totalRevenue,
    profit,
    marginPercent,
  };
}

function breakdownLine(
  line: RecipeLine,
  orderQuantity: number,
  materials?: RawMaterial[]
): MaterialLineBreakdown {
  const material = resolveMaterial(line.materialId, materials);
  const totalQuantity = line.quantityPerUnit * orderQuantity;
  const unitCost = material?.unitCost ?? 0;
  const lineCost = totalQuantity * unitCost;

  return {
    materialId: line.materialId,
    materialName: material?.name ?? "Bilinmeyen",
    unit: material?.unit ?? "—",
    quantityPerUnit: line.quantityPerUnit,
    totalQuantity,
    unitCost,
    lineCost,
  };
}

function breakdownExtra(
  extra: RecipeExtra,
  materials?: RawMaterial[]
): ExtraLineBreakdown {
  const material = resolveMaterial(extra.materialId, materials);
  const unitCost = material?.unitCost ?? 0;

  return {
    id: extra.id,
    materialId: extra.materialId,
    materialName: material?.name ?? "Bilinmeyen",
    unit: material?.unit ?? "—",
    quantity: extra.quantity,
    reason: extra.reason,
    unitCost,
    lineCost: extra.quantity * unitCost,
  };
}

export function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `₺${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
