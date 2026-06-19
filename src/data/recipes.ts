/** Reçete satırı: 1 birim çıktı başına malzeme miktarı */
export interface RecipeLine {
  materialId: string;
  quantityPerUnit: number;
}

/** Ek ürün — reçete altında not olarak; maliyete eklenir */
export interface RecipeExtra {
  id: string;
  materialId: string;
  quantity: number;
  reason: string;
}

export interface Recipe {
  id: string;
  orderId: string;
  productName: string;
  createdAt: string;
  createdBy: string;
  lines: RecipeLine[];
  extras: RecipeExtra[];
  status: "draft" | "saved";
}

export const seedRecipes: Recipe[] = [
  {
    id: "rec-1",
    orderId: "o1",
    productName: "CardioMax 50mg",
    createdAt: "2026-05-22T10:30:00",
    createdBy: "Ahmet Yılmaz",
    status: "saved",
    lines: [
      { materialId: "rm-1", quantityPerUnit: 0.00005 },
      { materialId: "rm-2", quantityPerUnit: 0.00012 },
      { materialId: "rm-3", quantityPerUnit: 0.000008 },
    ],
    extras: [
      {
        id: "ext-1",
        materialId: "rm-9",
        quantity: 2.5,
        reason:
          "Tablet kaynaklanması için ek stearik asit — üretim ekibi talebi",
      },
    ],
  },
  {
    id: "rec-2",
    orderId: "o7",
    productName: "CardioMax 50mg",
    createdAt: "2026-05-20T14:15:00",
    createdBy: "Elif Demir",
    status: "saved",
    lines: [
      { materialId: "rm-1", quantityPerUnit: 0.000048 },
      { materialId: "rm-2", quantityPerUnit: 0.00011 },
      { materialId: "rm-3", quantityPerUnit: 0.000007 },
    ],
    extras: [],
  },
];
