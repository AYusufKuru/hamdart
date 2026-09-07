import type { Recipe } from "@/data/recipes";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { todayIso } from "@/lib/utils";

export async function getAllRecipes(): Promise<Recipe[]> {
  return apiGet<Recipe[]>("/api/recipes");
}

export async function getRecipeByOrderId(orderId: string): Promise<Recipe | undefined> {
  const recipe = await apiGet<Recipe | null>(
    `/api/recipes/lookup?orderId=${encodeURIComponent(orderId)}`
  );
  return recipe ?? undefined;
}

export async function getRecipeForOrder(order: {
  id: string;
  product: string;
  recipeNo?: string;
}): Promise<Recipe | undefined> {
  const params = new URLSearchParams({
    orderId: order.id,
    product: order.product,
  });
  if (order.recipeNo) params.set("recipeNo", order.recipeNo);
  const recipe = await apiGet<Recipe | null>(
    `/api/recipes/lookup?${params.toString()}`
  );
  return recipe ?? undefined;
}

export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  return apiPut<Recipe>("/api/recipes", recipe);
}

export async function nextRecipeCode(): Promise<string> {
  const all = await getAllRecipes();
  let max = 0;
  for (const r of all) {
    const match = (r.code ?? "").match(/^REC-(\d+)$/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `REC-${String(max + 1).padStart(3, "0")}`;
}

export type CreateRecipeInput = {
  code?: string;
  productCode?: string;
  productName: string;
  lines: { materialName: string; unit: string; quantityPerUnit: number }[];
  createdBy?: string;
};

export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  return apiPost<Recipe>("/api/recipes", input);
}

export async function createEmptyRecipe(
  orderId: string,
  productName: string,
  createdBy: string
): Promise<Recipe> {
  const all = await getAllRecipes();
  const materials = await getAllRawMaterials();
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
