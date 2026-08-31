import type { Recipe } from "@/data/recipes";
import { seedRecipes } from "@/data/recipes";
import { rawMaterials } from "@/data/raw-materials";
import { readFromStorage, saveToStorage, todayIso } from "@/lib/utils";

const STORAGE_KEY = "hamdart-recipes";

function readStored(): Recipe[] {
  return readFromStorage<Recipe>(STORAGE_KEY);
}

function writeStored(recipes: Recipe[]): void {
  saveToStorage(STORAGE_KEY, recipes);
}

export function getAllRecipes(): Recipe[] {
  const stored = readStored();
  const byOrder = new Map<string, Recipe>();
  for (const r of seedRecipes) byOrder.set(r.orderId, r);
  for (const r of stored) byOrder.set(r.orderId, r);
  return Array.from(byOrder.values());
}

export function getRecipeByOrderId(orderId: string): Recipe | undefined {
  return getAllRecipes().find((r) => r.orderId === orderId);
}

export function saveRecipe(recipe: Recipe): void {
  const stored = readStored().filter((r) => r.orderId !== recipe.orderId);
  writeStored([...stored, recipe]);
}

export function createEmptyRecipe(
  orderId: string,
  productName: string,
  createdBy: string
): Recipe {
  return {
    id: `rec-${Date.now()}`,
    orderId,
    productName,
    createdAt: todayIso(),
    createdBy,
    lines: [
      {
        materialId: rawMaterials[0]?.id ?? "rm-2",
        quantityPerUnit: 0,
      },
    ],
    extras: [],
    status: "draft",
  };
}
