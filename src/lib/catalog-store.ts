import type {
  Customer,
  Supplier,
  Personnel,
  FinishedProduct,
  Invoice,
  InvoiceLine,
  InvoiceEvent,
  ChequeNote,
  ChequeNoteInstallment,
  DeliveryNote,
  DeliveryNoteLine,
  LedgerEntry,
  BudgetRow,
  BudgetCashEntry,
  BudgetCategory,
  DocumentSettings,
} from "@/data/catalog";
import type { Warehouse } from "@/data/warehouses";
import type { CashAccount } from "@/lib/cash-accounts";
import type { Role } from "@/lib/auth/permissions";
import { apiDelete, apiGet, apiPatch, apiPatchForm, apiPost, apiPostForm, apiPut } from "@/lib/api-client";

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

export async function fetchInvoiceEvents(invoiceNo?: string): Promise<InvoiceEvent[]> {
  if (!invoiceNo) return apiGet<InvoiceEvent[]>("/api/invoice-events");
  return apiGet<InvoiceEvent[]>(
    `/api/invoice-events?invoiceNo=${encodeURIComponent(invoiceNo)}`
  );
}

export async function postInvoiceEvent(form: FormData): Promise<InvoiceEvent> {
  return apiPostForm<InvoiceEvent>("/api/invoice-events", form);
}

export async function fetchChequeNotes(): Promise<ChequeNote[]> {
  return apiGet<ChequeNote[]>("/api/cheque-notes");
}

export async function fetchAvailableChequeInstallments(query: {
  kind?: string;
  direction?: string;
  party?: string;
}): Promise<
  Array<
    ChequeNoteInstallment & {
      docNo: string;
      kind: ChequeNote["kind"];
      direction: ChequeNote["direction"];
      party: string;
      bankName: string;
      currency: string;
    }
  >
> {
  const params = new URLSearchParams({ available: "1" });
  if (query.kind) params.set("kind", query.kind);
  if (query.direction) params.set("direction", query.direction);
  if (query.party) params.set("party", query.party);
  return apiGet(`/api/cheque-notes?${params.toString()}`);
}

export async function createChequeNote(body: unknown): Promise<ChequeNote> {
  return apiPost<ChequeNote>("/api/cheque-notes", body);
}

export async function updateChequeNote(id: string, body: unknown): Promise<ChequeNote> {
  return apiPatch<ChequeNote>(`/api/cheque-notes/${id}`, body);
}

export async function deleteChequeNote(id: string): Promise<void> {
  return apiDelete(`/api/cheque-notes/${id}`);
}

export async function fetchDeliveryNotes(): Promise<DeliveryNote[]> {
  return apiGet<DeliveryNote[]>("/api/catalog/delivery-notes");
}

export async function fetchDeliveryNoteLines(): Promise<DeliveryNoteLine[]> {
  return apiGet<DeliveryNoteLine[]>("/api/catalog/delivery-note-lines");
}

export async function fetchDocumentSettings(): Promise<DocumentSettings> {
  return apiGet<DocumentSettings>("/api/document-settings");
}

export async function saveDocumentSettings(
  body: Omit<DocumentSettings, "id">
): Promise<DocumentSettings> {
  return apiPut<DocumentSettings>("/api/document-settings", body);
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  return apiGet<LedgerEntry[]>("/api/catalog/ledger");
}

export async function fetchBudget(): Promise<BudgetRow[]> {
  return apiGet<BudgetRow[]>("/api/catalog/budget");
}

export async function fetchBudgetEntries(): Promise<BudgetCashEntry[]> {
  return apiGet<BudgetCashEntry[]>("/api/budget-entries");
}

export async function createBudgetEntry(body: unknown | FormData): Promise<BudgetCashEntry> {
  if (body instanceof FormData) return apiPostForm<BudgetCashEntry>("/api/budget-entries", body);
  return apiPost<BudgetCashEntry>("/api/budget-entries", body);
}

export async function updateBudgetEntry(id: string, body: unknown | FormData): Promise<BudgetCashEntry> {
  if (body instanceof FormData) return apiPatchForm<BudgetCashEntry>(`/api/budget-entries/${id}`, body);
  return apiPatch<BudgetCashEntry>(`/api/budget-entries/${id}`, body);
}

export async function deleteBudgetEntry(id: string): Promise<void> {
  return apiDelete(`/api/budget-entries/${id}`);
}

export async function fetchBudgetCategories(): Promise<BudgetCategory[]> {
  return apiGet<BudgetCategory[]>("/api/budget-categories");
}

export async function createBudgetCategory(body: unknown): Promise<BudgetCategory> {
  return apiPost<BudgetCategory>("/api/budget-categories", body);
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  return apiDelete(`/api/budget-categories/${id}`);
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

export type JobTitleRow = {
  id: string;
  name: string;
  createdAt: string;
};

export async function fetchJobTitles(): Promise<JobTitleRow[]> {
  return apiGet<JobTitleRow[]>("/api/job-titles");
}

export async function createJobTitle(name: string): Promise<JobTitleRow> {
  return apiPost<JobTitleRow>("/api/job-titles", { name });
}

export async function deleteJobTitle(id: string): Promise<void> {
  await apiDelete(`/api/job-titles/${id}`);
}

export async function fetchCashAccounts(): Promise<CashAccount[]> {
  return apiGet<CashAccount[]>("/api/cash-accounts");
}

export async function createCashAccount(body: unknown): Promise<CashAccount> {
  return apiPost<CashAccount>("/api/cash-accounts", body);
}

export async function updateCashAccount(id: string, body: unknown): Promise<CashAccount> {
  return apiPatch<CashAccount>(`/api/cash-accounts/${id}`, body);
}

export async function deleteCashAccount(id: string): Promise<void> {
  await apiDelete(`/api/cash-accounts/${id}`);
}
