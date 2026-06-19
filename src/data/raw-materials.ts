export type RawMaterialCategory = "Ham Madde" | "Eksipiyan" | "Ambalaj" | "Diğer";

export interface RawMaterial {
  id: string;
  sku: string;
  name: string;
  category: RawMaterialCategory;
  unit: string;
  /** Birim maliyet (₺) — maliyet hesabının kaynağı */
  unitCost: number;
}

export const rawMaterials: RawMaterial[] = [
  {
    id: "rm-1",
    sku: "RM-API-CM",
    name: "CardioMax API",
    category: "Ham Madde",
    unit: "kg",
    unitCost: 12500,
  },
  {
    id: "rm-2",
    sku: "RM-EXC-MCC",
    name: "Mikrokristalin Selüloz",
    category: "Eksipiyan",
    unit: "kg",
    unitCost: 85,
  },
  {
    id: "rm-3",
    sku: "RM-EXC-PVP",
    name: "Povidon K30",
    category: "Eksipiyan",
    unit: "kg",
    unitCost: 420,
  },
  {
    id: "rm-4",
    sku: "RM-API-NR",
    name: "NeuroRelief API",
    category: "Ham Madde",
    unit: "kg",
    unitCost: 18200,
  },
  {
    id: "rm-5",
    sku: "RM-EXC-LAC",
    name: "Laktoz Monohidrat",
    category: "Eksipiyan",
    unit: "kg",
    unitCost: 62,
  },
  {
    id: "rm-6",
    sku: "RM-PKG-BTL",
    name: "Şurup Şişesi 100ml",
    category: "Ambalaj",
    unit: "adet",
    unitCost: 3.2,
  },
  {
    id: "rm-7",
    sku: "RM-PKG-CAP",
    name: "Kapsül HPMC #0",
    category: "Ambalaj",
    unit: "adet",
    unitCost: 0.08,
  },
  {
    id: "rm-8",
    sku: "RM-API-IB",
    name: "ImmunoBoost Aktif",
    category: "Ham Madde",
    unit: "kg",
    unitCost: 24000,
  },
  {
    id: "rm-9",
    sku: "RM-EXC-STE",
    name: "Stearik Asit",
    category: "Eksipiyan",
    unit: "kg",
    unitCost: 195,
  },
  {
    id: "rm-10",
    sku: "RM-PKG-BOX",
    name: "Karton Kutu (10'lu)",
    category: "Ambalaj",
    unit: "adet",
    unitCost: 1.45,
  },
];

export function getRawMaterial(id: string): RawMaterial | undefined {
  return rawMaterials.find((m) => m.id === id);
}
