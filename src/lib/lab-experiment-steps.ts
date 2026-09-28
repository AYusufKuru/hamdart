import type { LabExperimentMaterialUsage } from "@/data/mock";

export type ExperimentStepKind = LabExperimentMaterialUsage["kind"] | "mixed";

export type ExperimentStepLine = {
  id: string;
  stockItemId: string;
  materialName: string;
  lotNo: string;
  quantity: number;
  unit: string;
  kind: LabExperimentMaterialUsage["kind"];
};

export type ExperimentStep = {
  step: number;
  addedAt: string;
  reason: string;
  kind: ExperimentStepKind;
  lines: ExperimentStepLine[];
};

export type ExperimentNetLot = {
  stockItemId: string;
  materialName: string;
  lotNo: string;
  unit: string;
  quantity: number;
};

export function nextExperimentStep(
  usages: LabExperimentMaterialUsage[]
): number {
  let max = 0;
  for (const usage of withUsageSteps(usages)) {
    const step = usage.step ?? 0;
    if (step > max) max = step;
  }
  return max + 1;
}

/** Eski kayıtlara adım numarası doldurur; mevcut step değerlerini korur. */
export function withUsageSteps(
  usages: LabExperimentMaterialUsage[]
): LabExperimentMaterialUsage[] {
  let max = 0;
  let initialBucket = 0;
  return usages.map((usage) => {
    if (typeof usage.step === "number" && usage.step > 0) {
      max = Math.max(max, usage.step);
      return usage;
    }
    if (usage.kind === "initial") {
      if (initialBucket === 0) {
        initialBucket = Math.max(1, max + 1);
        max = initialBucket;
      }
      return { ...usage, step: initialBucket };
    }
    initialBucket = 0;
    max += 1;
    return { ...usage, step: max };
  });
}

export function groupExperimentSteps(
  usages: LabExperimentMaterialUsage[]
): ExperimentStep[] {
  const byStep = new Map<number, LabExperimentMaterialUsage[]>();
  for (const usage of withUsageSteps(usages)) {
    const step = usage.step ?? 1;
    const list = byStep.get(step) ?? [];
    list.push(usage);
    byStep.set(step, list);
  }
  return [...byStep.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, lines]) => {
      const kinds = new Set(lines.map((line) => line.kind));
      const kind: ExperimentStepKind =
        kinds.size === 1 ? lines[0].kind : "mixed";
      const reasons = [
        ...new Set(lines.map((line) => line.reason.trim()).filter(Boolean)),
      ];
      return {
        step,
        addedAt: lines[0].addedAt,
        reason: reasons.join(" · "),
        kind,
        lines: lines.map((line) => ({
          id: line.id,
          stockItemId: line.stockItemId,
          materialName: line.materialName,
          lotNo: line.lotNo,
          quantity: line.quantity,
          unit: line.unit,
          kind: line.kind,
        })),
      };
    });
}

export function experimentStepCount(
  usages: LabExperimentMaterialUsage[] | undefined
): number {
  if (!usages?.length) return 0;
  return groupExperimentSteps(usages).length;
}

export function netExperimentLots(
  usages: LabExperimentMaterialUsage[]
): ExperimentNetLot[] {
  const byLot = new Map<string, ExperimentNetLot>();
  for (const usage of usages) {
    const prev = byLot.get(usage.stockItemId);
    if (prev) prev.quantity += usage.quantity;
    else {
      byLot.set(usage.stockItemId, {
        stockItemId: usage.stockItemId,
        materialName: usage.materialName,
        lotNo: usage.lotNo,
        unit: usage.unit,
        quantity: usage.quantity,
      });
    }
  }
  return [...byLot.values()]
    .filter((lot) => lot.quantity > 1e-9)
    .sort((a, b) => a.materialName.localeCompare(b.materialName, "tr"));
}

export function consumedMaterialTotals(usages: LabExperimentMaterialUsage[]) {
  const map = new Map<
    string,
    { materialName: string; unit: string; quantity: number }
  >();
  for (const usage of usages) {
    const key = `${usage.materialName}|${usage.unit}`;
    const prev = map.get(key);
    const quantity = Math.abs(usage.quantity);
    if (prev) prev.quantity += quantity;
    else {
      map.set(key, {
        materialName: usage.materialName,
        unit: usage.unit,
        quantity,
      });
    }
  }
  return [...map.values()]
    .filter((row) => row.quantity > 1e-9)
    .sort((a, b) => a.materialName.localeCompare(b.materialName, "tr"));
}

/** Reçete, her hammaddenin geçtiği son adımdaki miktardır. */
export function latestFormulaTotals(usages: LabExperimentMaterialUsage[]) {
  const latest = new Map<
    string,
    { materialName: string; unit: string; quantity: number }
  >();
  for (const step of groupExperimentSteps(usages)) {
    const inStep = new Map<
      string,
      { materialName: string; unit: string; quantity: number }
    >();
    for (const line of step.lines) {
      const key = `${line.materialName}|${line.unit}`;
      const prev = inStep.get(key);
      const quantity = Math.abs(line.quantity);
      if (prev) prev.quantity += quantity;
      else {
        inStep.set(key, {
          materialName: line.materialName,
          unit: line.unit,
          quantity,
        });
      }
    }
    for (const [key, row] of inStep) latest.set(key, row);
  }
  return [...latest.values()]
    .filter((row) => row.quantity > 1e-9)
    .sort((a, b) => a.materialName.localeCompare(b.materialName, "tr"));
}

export function latestFormulaLots(
  usages: LabExperimentMaterialUsage[]
): ExperimentNetLot[] {
  const latest = new Map<string, ExperimentNetLot>();
  for (const step of groupExperimentSteps(usages)) {
    const inStep = new Map<string, ExperimentNetLot>();
    for (const line of step.lines) {
      const prev = inStep.get(line.stockItemId);
      const quantity = Math.abs(line.quantity);
      if (prev) prev.quantity += quantity;
      else {
        inStep.set(line.stockItemId, {
          stockItemId: line.stockItemId,
          materialName: line.materialName,
          lotNo: line.lotNo,
          unit: line.unit,
          quantity,
        });
      }
    }
    for (const [id, row] of inStep) latest.set(id, row);
  }
  return [...latest.values()]
    .filter((lot) => lot.quantity > 1e-9)
    .sort((a, b) => a.materialName.localeCompare(b.materialName, "tr"));
}

export function stepKindLabel(kind: ExperimentStepKind) {
  if (kind === "initial") return "Başlangıç";
  if (kind === "extra") return "Ekleme";
  if (kind === "return") return "Azaltma";
  return "Düzeltme";
}
