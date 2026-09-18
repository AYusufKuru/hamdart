import { capitalizeWordsTr } from "@/lib/utils";

/** Personel kaydındaki görev adı — laboratuvar listeleri buna bakarak dolar. */
export const LAB_WORKER_TITLE = "Laboratuvar çalışanı";
export const ANALYST_DEPARTMENT = "Analist";
export const RESEARCHER_DEPARTMENT = "Araştırmacı";
export const LAB_PERSONNEL_DEPARTMENTS = [
  ANALYST_DEPARTMENT,
  RESEARCHER_DEPARTMENT,
] as const;

export const PERSONNEL_TITLE_OPTIONS = [LAB_WORKER_TITLE] as const;

/** Birden fazla görev tek string'de bu ayırıcıyla saklanır. */
export const PERSONNEL_TITLE_SEPARATOR = " · ";

export type LabPersonRole = "analyst" | "researcher";

export function labDepartmentForRole(role: LabPersonRole) {
  return role === "analyst" ? ANALYST_DEPARTMENT : RESEARCHER_DEPARTMENT;
}

export function matchesLabPersonnelDepartment(
  department: string,
  role: LabPersonRole
) {
  const key = department.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  if (role === "analyst") return key === "analist";
  return key === "araştırmacı" || key === "arastirmaci";
}

function normalizeTitleKey(title: string): string {
  return title.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

export function isLabWorkerTitle(title: string): boolean {
  return parsePersonnelTitles(title).some((part) => {
    const normalized = normalizeTitleKey(part);
    return (
      normalized === "laboratuvar çalışanı" ||
      normalized === "laboratuvar calisani" ||
      normalized === "labaratuvar çalışanı"
    );
  });
}

export function parsePersonnelTitles(title: string): string[] {
  if (!title.trim()) return [];
  const parts = title
    .split(/\s*[·,;|]\s*|\s+\/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = normalizeTitleKey(part);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function serializePersonnelTitles(titles: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const normalized = normalizePersonnelTitlePart(raw);
    if (!normalized) continue;
    const key = normalizeTitleKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out.join(PERSONNEL_TITLE_SEPARATOR);
}

function normalizePersonnelTitlePart(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const key = normalizeTitleKey(trimmed);
  if (
    key === "laboratuvar çalışanı" ||
    key === "laboratuvar calisani" ||
    key === "labaratuvar çalışanı"
  ) {
    return LAB_WORKER_TITLE;
  }
  return capitalizeWordsTr(trimmed);
}

/** Tek veya çoklu görev string'ini normalize eder. */
export function normalizePersonnelTitle(title: string): string {
  return serializePersonnelTitles(parsePersonnelTitles(title));
}

export function personnelDisplayName(person: {
  firstName: string;
  lastName: string;
}): string {
  return `${person.firstName} ${person.lastName}`.trim();
}
