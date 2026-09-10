import type {
  BatchStatus,
  ProductionBatch,
  ProductionLine,
} from "@/data/mock";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

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
  { value: "queued", label: "Sırada" },
  { value: "qc_pending", label: "KK Bekliyor" },
  { value: "completed", label: "Tamamlandı" },
  { value: "rejected", label: "Reddedildi" },
];

export async function getAllProductionBatches(): Promise<ProductionBatch[]> {
  return apiGet<ProductionBatch[]>("/api/production/batches");
}

export async function getAllProductionLines(): Promise<ProductionLine[]> {
  return apiGet<ProductionLine[]>("/api/production/lines");
}

export async function getKnownProducts(): Promise<string[]> {
  const lines = await getAllProductionLines();
  const batches = await getAllProductionBatches();
  const fromLines = lines.map((l) => l.product);
  const fromBatches = batches.map((b) => b.product);
  return [...new Set([...fromLines, ...fromBatches].filter((p) => p.trim() && p !== "-"))].sort(
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

export async function nextBatchNo(lineName: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = prefixForLine(lineName);
  let max = 0;
  for (const b of await getAllProductionBatches()) {
    const match = b.batchNo.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
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

export async function updateProductionLine(
  id: string,
  patch: Partial<Omit<ProductionLine, "id">>
): Promise<ProductionLine | undefined> {
  try {
    return await apiPatch<ProductionLine>("/api/production/lines", { id, patch });
  } catch {
    return undefined;
  }
}

export async function createProductionBatch(
  input: CreateBatchInput
): Promise<ProductionBatch> {
  return apiPost<ProductionBatch>("/api/production/batches", input);
}

export async function updateProductionBatch(
  id: string,
  body: {
    action?: "complete_and_next" | "start_next";
    patch?: { status?: BatchStatus };
  }
): Promise<ProductionBatch> {
  return apiPatch<ProductionBatch>("/api/production/batches", { id, ...body });
}

export function queuedBatchesForLine(
  batches: ProductionBatch[],
  lineName: string
): ProductionBatch[] {
  return batches
    .filter((b) => b.line === lineName && b.status === "queued")
    .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999));
}

export function lineHasActiveBatch(
  batches: ProductionBatch[],
  lineName: string
): boolean {
  return batches.some((b) => b.line === lineName && b.status === "in_progress");
}
