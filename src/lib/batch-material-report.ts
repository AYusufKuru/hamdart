import type { BatchMaterialUsage, ProductionBatch } from "@/data/mock";
import { formatNumber } from "@/lib/utils";

export type MaterialVarianceRow = BatchMaterialUsage & {
  variance: number | null;
  percentOfRecipe: number | null;
};

export function batchMaterialRows(
  usage: BatchMaterialUsage[] | undefined
): MaterialVarianceRow[] {
  return (usage ?? []).map((line) => {
    const actual = line.actual;
    const estimated = line.estimated;
    const variance =
      actual !== null && Number.isFinite(actual) ? actual - estimated : null;
    const percentOfRecipe =
      actual !== null &&
      Number.isFinite(actual) &&
      estimated > 0
        ? (actual / estimated) * 100
        : null;
    return { ...line, variance, percentOfRecipe };
  });
}

/** Toplam gerçekleşen / toplam tahmini → reçete kullanım oranı */
export function recipeUsagePercent(
  usage: BatchMaterialUsage[] | undefined
): number | null {
  const rows = usage ?? [];
  let estimated = 0;
  let actual = 0;
  let hasActual = false;
  for (const line of rows) {
    if (line.estimated > 0) estimated += line.estimated;
    if (line.actual !== null && Number.isFinite(line.actual)) {
      actual += line.actual;
      hasActual = true;
    }
  }
  if (!hasActual || !(estimated > 0)) return null;
  return (actual / estimated) * 100;
}

export function formatUsagePercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `%${formatNumber(Math.round(value * 10) / 10)}`;
}

export function formatVariance(
  variance: number | null,
  unit: string
): string {
  if (variance === null || !Number.isFinite(variance)) return "—";
  const sign = variance > 0 ? "+" : "";
  return `${sign}${formatNumber(variance)} ${unit}`.trim();
}

export function isFinishedBatch(batch: ProductionBatch): boolean {
  return batch.status === "completed" || batch.status === "rejected";
}

export type MaterialHistoryAgg = {
  materialName: string;
  unit: string;
  estimatedTotal: number;
  actualTotal: number;
  batchCount: number;
};

/** Geçmiş partilerde hammadde bazında toplam giden miktar */
export function aggregateMaterialHistory(
  batches: ProductionBatch[]
): MaterialHistoryAgg[] {
  const map = new Map<string, MaterialHistoryAgg>();
  for (const batch of batches) {
    if (!isFinishedBatch(batch)) continue;
    const seen = new Set<string>();
    for (const line of batch.materialUsage ?? []) {
      const key = `${line.materialName.trim().toLocaleLowerCase("tr")}|${line.unit}`;
      const prev = map.get(key) ?? {
        materialName: line.materialName,
        unit: line.unit,
        estimatedTotal: 0,
        actualTotal: 0,
        batchCount: 0,
      };
      prev.estimatedTotal += line.estimated || 0;
      if (line.actual !== null && Number.isFinite(line.actual)) {
        prev.actualTotal += line.actual;
      }
      if (!seen.has(key)) {
        prev.batchCount += 1;
        seen.add(key);
      }
      map.set(key, prev);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.materialName.localeCompare(b.materialName, "tr")
  );
}
