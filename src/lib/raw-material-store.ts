import {
  rawMaterials as seedMaterials,
  type RawMaterial,
  type RawMaterialCategory,
} from "@/data/raw-materials";
import { readFromStorage, saveToStorage } from "@/lib/utils";

const STORAGE_KEY = "hamdart-raw-materials";

export const RAW_MATERIAL_CATEGORIES: RawMaterialCategory[] = [
  "Ham Madde",
  "Eksipiyan",
  "Ambalaj",
  "Diğer",
];

export const RAW_MATERIAL_UNITS = ["kg", "g", "adet", "L", "mL"] as const;

function readStored(): RawMaterial[] {
  return readFromStorage<RawMaterial>(STORAGE_KEY);
}

function writeStored(list: RawMaterial[]): void {
  saveToStorage(STORAGE_KEY, list);
}

export function getAllRawMaterials(): RawMaterial[] {
  const stored = readStored();
  const byId = new Map<string, RawMaterial>();
  for (const m of seedMaterials) byId.set(m.id, m);
  for (const m of stored) byId.set(m.id, m);
  return Array.from(byId.values());
}

export function getRawMaterialById(id: string): RawMaterial | undefined {
  return getAllRawMaterials().find((m) => m.id === id);
}

export function getRawMaterialBySku(sku: string): RawMaterial | undefined {
  const key = sku.trim().toLowerCase();
  return getAllRawMaterials().find((m) => m.sku.toLowerCase() === key);
}

export type CreateRawMaterialInput = {
  sku: string;
  name: string;
  category: RawMaterialCategory;
  unit: string;
  unitCost: number;
};

export function createRawMaterial(input: CreateRawMaterialInput): RawMaterial {
  const sku = input.sku.trim();
  if (getRawMaterialBySku(sku)) {
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
  const stored = readStored().filter((m) => m.id !== material.id);
  writeStored([material, ...stored]);
  return material;
}
