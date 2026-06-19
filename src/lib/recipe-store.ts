import type { Recipe } from "@/data/recipes";
import { seedRecipes } from "@/data/recipes";

const STORAGE_KEY = "hamdart-recipes";

function readStored(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Recipe[];
  } catch {
    return [];
  }
}

function writeStored(recipes: Recipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
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
    createdAt: new Date().toISOString(),
    createdBy,
    lines: [{ materialId: "rm-2", quantityPerUnit: 0 }],
    extras: [],
    status: "draft",
  };
}
