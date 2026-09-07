/** Reçete satırı: 1 birim çıktı başına malzeme miktarı */
export interface RecipeLine {
  materialId: string;
  materialName?: string;
  unit?: string;
  quantityPerUnit: number;
}

export interface RecipeExtra {
  id: string;
  materialId: string;
  quantity: number;
  reason: string;
}

export interface Recipe {
  id: string;
  code?: string;
  productCode?: string;
  orderId: string;
  productName: string;
  createdAt: string;
  createdBy: string;
  lines: RecipeLine[];
  extras: RecipeExtra[];
  status: "draft" | "saved";
}
