import {
  labExperiments as seedExperiments,
  labSamples as seedSamples,
  type ExperimentStatus,
  type LabExperiment,
  type LabSample,
} from "@/data/mock";
import { readFromStorage, saveToStorage } from "@/lib/utils";

const EXP_KEY = "hamdart-lab-experiments";
const SMP_KEY = "hamdart-lab-samples";

export const EXPERIMENT_STATUSES: { value: ExperimentStatus; label: string }[] =
  [
    { value: "planning", label: "Planlama" },
    { value: "running", label: "Devam Ediyor" },
    { value: "analysis", label: "Analiz" },
    { value: "approved", label: "Onaylandı" },
    { value: "on_hold", label: "Beklemede" },
  ];

export const SAMPLE_STATUSES: {
  value: LabSample["status"];
  label: string;
}[] = [
  { value: "received", label: "Alındı" },
  { value: "testing", label: "Test Ediliyor" },
  { value: "approved", label: "Onaylı" },
  { value: "rejected", label: "Red" },
];

export const LAB_DEPARTMENTS = [
  "Formülasyon",
  "Kalite Kontrol",
  "Ar-Ge",
  "Medikal Cihaz",
  "Mikrobiyoloji",
] as const;

export const SAMPLE_TYPES = [
  "Üretim Numunesi",
  "Stabilite",
  "Serbest Bırakma",
  "Kalite Kontrol",
  "Sterilite",
] as const;

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

export function getAllLabExperiments(): LabExperiment[] {
  return mergeById(seedExperiments, readStored<LabExperiment>(EXP_KEY)).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

export function getAllLabSamples(): LabSample[] {
  return mergeById(seedSamples, readStored<LabSample>(SMP_KEY)).sort(
    (a, b) =>
      new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
  );
}

export function nextExperimentCode(): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const e of getAllLabExperiments()) {
    const match = e.code.match(new RegExp(`^EXP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EXP-${year}-${String(max + 1).padStart(3, "0")}`;
}

export function nextSampleNo(): string {
  const year = new Date().getFullYear();
  let max = 0;
  for (const s of getAllLabSamples()) {
    const match = s.sampleNo.match(new RegExp(`^SMP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `SMP-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function getLabResearchers(): string[] {
  return [
    ...new Set(getAllLabExperiments().map((e) => e.researcher)),
  ].sort((a, b) => a.localeCompare(b, "tr"));
}

export function getLabAnalysts(): string[] {
  return [...new Set(getAllLabSamples().map((s) => s.analyst))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export function getLabDepartments(): string[] {
  const fromData = getAllLabExperiments().map((e) => e.department);
  return [...new Set([...LAB_DEPARTMENTS, ...fromData])].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export function getSampleTypes(): string[] {
  const fromData = getAllLabSamples().map((s) => s.type);
  return [...new Set([...SAMPLE_TYPES, ...fromData])];
}

export type CreateExperimentInput = {
  code?: string;
  title: string;
  researcher: string;
  department: string;
  status: ExperimentStatus;
  startDate: string;
  dueDate: string;
  progress: number;
  samples: number;
  priority: LabExperiment["priority"];
};

export function createLabExperiment(input: CreateExperimentInput): LabExperiment {
  const code = input.code?.trim() || nextExperimentCode();
  if (
    getAllLabExperiments().some(
      (e) => e.code.toLowerCase() === code.toLowerCase()
    )
  ) {
    throw new Error("Bu deney kodu zaten kayıtlı");
  }
  const experiment: LabExperiment = {
    id: `e-${Date.now()}`,
    code,
    title: input.title.trim(),
    researcher: input.researcher.trim(),
    department: input.department,
    status: input.status,
    startDate: input.startDate,
    dueDate: input.dueDate,
    progress: input.progress,
    samples: input.samples,
    priority: input.priority,
  };
  const stored = readStored<LabExperiment>(EXP_KEY).filter(
    (e) => e.id !== experiment.id
  );
  writeStored(EXP_KEY, [experiment, ...stored]);
  return experiment;
}

export type CreateSampleInput = {
  sampleNo?: string;
  product: string;
  batchNo: string;
  type: string;
  status: LabSample["status"];
  receivedDate: string;
  analyst: string;
  result?: string;
};

export function createLabSample(input: CreateSampleInput): LabSample {
  const sampleNo = input.sampleNo?.trim() || nextSampleNo();
  if (
    getAllLabSamples().some(
      (s) => s.sampleNo.toLowerCase() === sampleNo.toLowerCase()
    )
  ) {
    throw new Error("Bu numune numarası zaten kayıtlı");
  }
  const sample: LabSample = {
    id: `ls-${Date.now()}`,
    sampleNo,
    product: input.product.trim(),
    batchNo: input.batchNo.trim(),
    type: input.type,
    status: input.status,
    receivedDate: input.receivedDate,
    analyst: input.analyst.trim(),
    result: input.result?.trim() || undefined,
  };
  const stored = readStored<LabSample>(SMP_KEY).filter((s) => s.id !== sample.id);
  writeStored(SMP_KEY, [sample, ...stored]);
  return sample;
}
