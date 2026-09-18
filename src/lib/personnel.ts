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

export function isLabWorkerTitle(title: string): boolean {
  const normalized = title.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  return (
    normalized === "laboratuvar çalışanı" ||
    normalized === "laboratuvar calisani" ||
    normalized === "labaratuvar çalışanı"
  );
}

export function normalizePersonnelTitle(title: string): string {
  const trimmed = title.trim();
  if (isLabWorkerTitle(trimmed)) return LAB_WORKER_TITLE;
  return capitalizeWordsTr(trimmed);
}

export function personnelDisplayName(person: {
  firstName: string;
  lastName: string;
}): string {
  return `${person.firstName} ${person.lastName}`.trim();
}
