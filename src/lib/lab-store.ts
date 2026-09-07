import type { ExperimentStatus, LabExperiment, LabSample } from "@/data/mock";
import { apiGet, apiPost } from "@/lib/api-client";

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

export async function getAllLabExperiments(): Promise<LabExperiment[]> {
  return apiGet<LabExperiment[]>("/api/lab/experiments");
}

export async function getAllLabSamples(): Promise<LabSample[]> {
  return apiGet<LabSample[]>("/api/lab/samples");
}

export async function nextExperimentCode(): Promise<string> {
  const year = new Date().getFullYear();
  let max = 0;
  for (const e of await getAllLabExperiments()) {
    const match = e.code.match(new RegExp(`^EXP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `EXP-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function nextSampleNo(): Promise<string> {
  const year = new Date().getFullYear();
  let max = 0;
  for (const s of await getAllLabSamples()) {
    const match = s.sampleNo.match(new RegExp(`^SMP-${year}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `SMP-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function getLabResearchers(): Promise<string[]> {
  const experiments = await getAllLabExperiments();
  return [...new Set(experiments.map((e) => e.researcher))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getLabAnalysts(): Promise<string[]> {
  const samples = await getAllLabSamples();
  return [...new Set(samples.map((s) => s.analyst))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getLabDepartments(): Promise<string[]> {
  const experiments = await getAllLabExperiments();
  const fromData = experiments.map((e) => e.department);
  return [...new Set([...LAB_DEPARTMENTS, ...fromData])].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

export async function getSampleTypes(): Promise<string[]> {
  const samples = await getAllLabSamples();
  const fromData = samples.map((s) => s.type);
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

export async function createLabExperiment(
  input: CreateExperimentInput
): Promise<LabExperiment> {
  return apiPost<LabExperiment>("/api/lab/experiments", input);
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

export async function createLabSample(
  input: CreateSampleInput
): Promise<LabSample> {
  return apiPost<LabSample>("/api/lab/samples", input);
}
