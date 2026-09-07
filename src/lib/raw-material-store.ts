import type { RawMaterial, RawMaterialCategory } from "@/data/raw-materials";
import { apiGet, apiPost } from "@/lib/api-client";

export const RAW_MATERIAL_CATEGORIES: RawMaterialCategory[] = [
  "Paketleme",
  "Kimyasal",
  "Bitki",
  "Ekstrakt",
  "Kapsül",
  "Yağ",
  "Eksipiyan",
  "Etken madde",
  "Ham Madde",
  "Ambalaj",
  "Diğer",
];

export const RAW_MATERIAL_UNITS = ["kg", "g", "adet", "L", "mL"] as const;

export async function getAllRawMaterials(): Promise<RawMaterial[]> {
  return apiGet<RawMaterial[]>("/api/raw-materials");
}

export async function getRawMaterialById(id: string): Promise<RawMaterial | undefined> {
  const all = await getAllRawMaterials();
  return all.find((m) => m.id === id);
}

export async function getRawMaterialBySku(sku: string): Promise<RawMaterial | undefined> {
  const key = sku.trim().toLowerCase();
  const all = await getAllRawMaterials();
  return all.find((m) => m.sku.toLowerCase() === key);
}

export type CreateRawMaterialInput = {
  sku: string;
  name: string;
  category: RawMaterialCategory;
  unit: string;
  unitCost: number;
};

export async function createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial> {
  return apiPost<RawMaterial>("/api/raw-materials", input);
}
