import {
  productionBatches as seedBatches,
  productionLines as seedLines,
  type BatchStatus,
  type ProductionBatch,
  type ProductionLine,
} from "@/data/mock";
import { readFromStorage, saveToStorage } from "@/lib/utils";

const BATCH_KEY = "hamdart-production-batches";
const LINE_KEY = "hamdart-production-lines";

export const BATCH_UNITS = [
  "tablet",
  "kapsül",
  "şişe",
  "adet",
  "kalem",
] as const;

export const BATCH_STATUS_OPTIONS: { value: BatchStatus; label: string }[] = [
  { value: "planned", label: "Planlandı" },
  { value: "in_progress", label: "Üretimde" },
  { value: "qc_pending", label: "KK Bekliyor" },
  { value: "completed", label: "Tamamlandı" },
  { value: "rejected", label: "Reddedildi" },
];

function readStored<T>(key: string): T[] {
  return readFromStorage<T>(key);
}

function writeStored<T>(key: string, list: T[]): void {
  saveToStorage(key, list);
}

function mergeById<T extends { id: string }>(seed: T[], stored: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of seed) byId.set(item.id, item);
  for (const item of stored) byId.set(item.id, item);
  return Array.from(byId.values());
}

export function getAllProductionBatches(): ProductionBatch[] {
  return mergeById(seedBatches, readStored<ProductionBatch>(BATCH_KEY)).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

export function getAllProductionLines(): ProductionLine[] {
  const merged = mergeById(seedLines, readStored<ProductionLine>(LINE_KEY));
  return seedLines.map((seed) => merged.find((l) => l.id === seed.id) ?? seed);
}

export function getKnownProducts(): string[] {
  const fromLines = getAllProductionLines().map((l) => l.product);
  const fromBatches = getAllProductionBatches().map((b) => b.product);
  return [...new Set([...fromLines, ...fromBatches].filter((p) => p && p !== "-"))].sort(
    (a, b) => a.localeCompare(b, "tr")
  );
}

export function prefixForLine(lineName: string): string {
  const n = lineName.toLocaleLowerCase("tr");
  if (n.includes("şurup")) return "SR";
  if (n.includes("enjeksiyon") || n.includes("steril")) return "INJ";
  if (n.includes("kapsül")) return "CAP";
  return "BT";
}

export function suggestUnit(product: string, lineName: string): string {
  const p = `${product} ${lineName}`.toLocaleLowerCase("tr");
  if (p.includes("şurup")) return "şişe";
  if (p.includes("pen") || p.includes("kalem")) return "kalem";
  if (p.includes("kapsül")) return "kapsül";
  if (p.includes("iv") || p.includes("saline")) return "adet";
  return "tablet";
}

export function nextBatchNo(lineName: string): string {
  const year = new Date().getFullYear();
  const prefix = prefixForLine(lineName);
  let max = 0;
  for (const b of getAllProductionBatches()) {
    const match = b.batchNo.match(
      new RegExp(`^${prefix}-${year}-(\\d+)$`)
    );
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export type CreateBatchInput = {
  batchNo?: string;
  product: string;
  line: string;
  status: BatchStatus;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  yield: number;
  qcScore: number;
};

function saveLine(line: ProductionLine): void {
  const stored = readStored<ProductionLine>(LINE_KEY).filter(
    (l) => l.id !== line.id
  );
  writeStored(LINE_KEY, [...stored, line]);
}

export function updateProductionLine(
  id: string,
  patch: Partial<Omit<ProductionLine, "id">>
): ProductionLine | undefined {
  const line = getAllProductionLines().find((l) => l.id === id);
  if (!line) return undefined;
  const next = { ...line, ...patch, id };
  saveLine(next);
  return next;
}

export function createProductionBatch(input: CreateBatchInput): ProductionBatch {
  const batchNo = input.batchNo?.trim() || nextBatchNo(input.line);
  if (
    getAllProductionBatches().some(
      (b) => b.batchNo.toLowerCase() === batchNo.toLowerCase()
    )
  ) {
    throw new Error("Bu batch numarası zaten kayıtlı");
  }
  const batch: ProductionBatch = {
    id: `b-${Date.now()}`,
    batchNo,
    product: input.product.trim(),
    line: input.line,
    status: input.status,
    quantity: input.quantity,
    unit: input.unit,
    startDate: input.startDate,
    endDate: input.endDate,
    yield: input.yield,
    qcScore: input.qcScore,
  };

  const stored = readStored<ProductionBatch>(BATCH_KEY).filter(
    (b) => b.id !== batch.id
  );
  writeStored(BATCH_KEY, [batch, ...stored]);

  if (input.status === "in_progress") {
    const line = getAllProductionLines().find((l) => l.name === input.line);
    if (line) {
      saveLine({
        ...line,
        product: batch.product,
        currentBatch: batch.batchNo,
        status: line.status === "idle" ? "active" : line.status,
      });
    }
  }

  return batch;
}
