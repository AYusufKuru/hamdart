export type RawMaterialCategory = string;

export interface RawMaterial {
  id: string;
  sku: string;
  name: string;
  category: RawMaterialCategory;
  unit: string;
  unitCost: number;
}
