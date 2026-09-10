import type {
  Customer,
  Supplier,
  Personnel,
  FinishedProduct,
  Invoice,
  InvoiceLine,
  LedgerEntry,
  BudgetRow,
} from "@/data/catalog";
import type { Warehouse } from "@/data/warehouses";
import type { Role } from "@/lib/auth/permissions";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

export async function fetchCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>("/api/catalog/customers");
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  return apiGet<Supplier[]>("/api/catalog/suppliers");
}

export async function fetchPersonnel(): Promise<Personnel[]> {
  return apiGet<Personnel[]>("/api/catalog/personnel");
}

export async function fetchProducts(): Promise<FinishedProduct[]> {
  return apiGet<FinishedProduct[]>("/api/catalog/products");
}

export async function fetchInvoices(): Promise<Invoice[]> {
  return apiGet<Invoice[]>("/api/catalog/invoices");
}

export async function fetchInvoiceLines(): Promise<InvoiceLine[]> {
  return apiGet<InvoiceLine[]>("/api/catalog/invoice-lines");
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  return apiGet<LedgerEntry[]>("/api/catalog/ledger");
}

export async function fetchBudget(): Promise<BudgetRow[]> {
  return apiGet<BudgetRow[]>("/api/catalog/budget");
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  return apiGet<Warehouse[]>("/api/catalog/warehouses");
}

export async function createCatalog<T>(
  entity: string,
  body: unknown
): Promise<T> {
  return apiPost<T>(`/api/catalog/${entity}`, body);
}

export async function updateCatalog<T>(
  entity: string,
  id: string,
  body: unknown
): Promise<T> {
  return apiPatch<T>(`/api/catalog/${entity}/${id}`, body);
}

export async function deleteCatalog(
  entity: string,
  id: string
): Promise<{ ok: true; deactivated?: boolean }> {
  return apiDelete(`/api/catalog/${entity}/${id}`);
}

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
};

export type BackupInfo = {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  note: string | null;
};

export async function fetchAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  return apiGet<AuditLogRow[]>(`/api/audit?limit=${limit}`);
}

export async function fetchBackups(): Promise<BackupInfo[]> {
  return apiGet<BackupInfo[]>("/api/backups");
}

export async function createBackup(note?: string): Promise<BackupInfo> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<BackupInfo>("/api/backups", { note });
}

export async function restoreBackup(
  id: string,
  confirmFilename: string
): Promise<void> {
  const { apiPost } = await import("@/lib/api-client");
  await apiPost(`/api/backups/${id}`, { confirmFilename });
}

export async function deleteBackup(id: string): Promise<void> {
  const { apiDelete } = await import("@/lib/api-client");
  await apiDelete(`/api/backups/${id}`);
}

export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  createdAt: string;
};

export async function fetchUsers(): Promise<UserRow[]> {
  return apiGet<UserRow[]>("/api/users");
}

export async function createUser(input: {
  username: string;
  name: string;
  role: Role;
  password: string;
}): Promise<UserRow> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<UserRow>("/api/users", input);
}

export async function updateUser(
  id: string,
  patch: {
    name?: string;
    role?: Role;
    active?: boolean;
    password?: string;
  }
): Promise<UserRow> {
  const { apiPatch } = await import("@/lib/api-client");
  return apiPatch<UserRow>(`/api/users/${id}`, patch);
}

export async function deleteUser(id: string): Promise<void> {
  const { apiDelete } = await import("@/lib/api-client");
  await apiDelete(`/api/users/${id}`);
}

export type DepartmentRow = {
  id: string;
  name: string;
  createdAt: string;
};

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  return apiGet<DepartmentRow[]>("/api/departments");
}

export async function createDepartment(name: string): Promise<DepartmentRow> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<DepartmentRow>("/api/departments", { name });
}

export async function updateDepartment(
  id: string,
  name: string
): Promise<DepartmentRow> {
  const { apiPatch } = await import("@/lib/api-client");
  return apiPatch<DepartmentRow>(`/api/departments/${id}`, { name });
}

export async function deleteDepartment(id: string): Promise<void> {
  const { apiDelete } = await import("@/lib/api-client");
  await apiDelete(`/api/departments/${id}`);
}
