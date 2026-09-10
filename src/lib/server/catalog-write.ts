import type {
  BudgetRow,
  Customer,
  Invoice,
  InvoiceLine,
  LedgerEntry,
  Personnel,
  Supplier,
} from "@/data/catalog";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { ConflictError, FieldError } from "@/lib/server/fields";
import { capitalizeWordsTr } from "@/lib/utils";

type AuditCtx = { actor: string; ip?: string };

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toCustomer(row: {
  id: string;
  name: string;
  contact: string;
  address: string;
  taxNo: string;
  email: string;
  active: boolean;
}): Customer {
  return { ...row };
}

function toSupplier(row: {
  id: string;
  name: string;
  contact: string;
  address: string;
  active: boolean;
}): Supplier {
  return { ...row };
}

function toPersonnel(row: {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  hireDate: string;
  salary: unknown;
  iban: string;
}): Personnel {
  return {
    ...row,
    salary: asNumber(row.salary),
  };
}

function toInvoice(row: {
  id: string;
  invoiceNo: string;
  party: string;
  kind: string;
  issueDate: string;
  dueDate: string;
  amount: unknown;
  status: string;
}): Invoice {
  return {
    ...row,
    amount: asNumber(row.amount),
  };
}

function toLedger(row: {
  id: string;
  date: string;
  documentNo: string;
  description: string;
  category: string;
  direction: string;
  amount: unknown;
  status: string;
}): LedgerEntry {
  return {
    ...row,
    amount: asNumber(row.amount),
  };
}

function toBudget(row: {
  id: string;
  department: string;
  annual: unknown;
  spent: unknown;
}): BudgetRow {
  return {
    ...row,
    annual: asNumber(row.annual),
    spent: asNumber(row.spent),
  };
}

export function maskPersonnel(row: Personnel): Personnel {
  return { ...row, salary: null, iban: null };
}

async function customerHasLinks(name: string): Promise<boolean> {
  const [invoices, orders] = await Promise.all([
    prisma.invoice.count({ where: { party: name } }),
    prisma.order.count({ where: { customer: name } }),
  ]);
  return invoices + orders > 0;
}

async function supplierHasLinks(name: string): Promise<boolean> {
  const count = await prisma.rawMaterialOrder.count({
    where: { supplier: name },
  });
  return count > 0;
}

export async function dbCreateCustomer(
  input: {
    name: string;
    contact: string;
    address: string;
    taxNo: string;
    email: string;
  },
  ctx: AuditCtx
): Promise<Customer> {
  const row = await prisma.customer.create({
    data: {
      id: `cus-${Date.now()}`,
      name: input.name,
      contact: input.contact,
      address: input.address,
      taxNo: input.taxNo,
      email: input.email,
      active: true,
    },
  });
  const mapped = toCustomer(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Customer",
    entityId: mapped.id,
    summary: `Müşteri eklendi: ${mapped.name}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateCustomer(
  id: string,
  input: Partial<{
    name: string;
    contact: string;
    address: string;
    taxNo: string;
    email: string;
    active: boolean;
  }>,
  ctx: AuditCtx
): Promise<Customer> {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw new FieldError("Müşteri bulunamadı");
  const row = await prisma.customer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contact !== undefined ? { contact: input.contact } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.taxNo !== undefined ? { taxNo: input.taxNo } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  const mapped = toCustomer(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Customer",
    entityId: id,
    summary: `Müşteri güncellendi: ${mapped.name}`,
    before: toCustomer(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteCustomer(
  id: string,
  ctx: AuditCtx
): Promise<{ ok: true; deactivated?: boolean; customer?: Customer }> {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw new FieldError("Müşteri bulunamadı");
  if (await customerHasLinks(before.name)) {
    const row = await prisma.customer.update({
      where: { id },
      data: { active: false },
    });
    const mapped = toCustomer(row);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "Customer",
      entityId: id,
      summary: `Müşteri pasife alındı (bağlı kayıt): ${mapped.name}`,
      before: toCustomer(before),
      after: mapped,
      ipAddress: ctx.ip,
    });
    return { ok: true, deactivated: true, customer: mapped };
  }
  await prisma.customer.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "Customer",
    entityId: id,
    summary: `Müşteri silindi: ${before.name}`,
    before: toCustomer(before),
    ipAddress: ctx.ip,
  });
  return { ok: true };
}

export async function dbCreateSupplier(
  input: { name: string; contact: string; address: string },
  ctx: AuditCtx
): Promise<Supplier> {
  const row = await prisma.supplier.create({
    data: {
      id: `sup-${Date.now()}`,
      name: input.name,
      contact: input.contact,
      address: input.address,
      active: true,
    },
  });
  const mapped = toSupplier(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Supplier",
    entityId: mapped.id,
    summary: `Tedarikçi eklendi: ${mapped.name}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateSupplier(
  id: string,
  input: Partial<{ name: string; contact: string; address: string; active: boolean }>,
  ctx: AuditCtx
): Promise<Supplier> {
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) throw new FieldError("Tedarikçi bulunamadı");
  const row = await prisma.supplier.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contact !== undefined ? { contact: input.contact } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  const mapped = toSupplier(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Supplier",
    entityId: id,
    summary: `Tedarikçi güncellendi: ${mapped.name}`,
    before: toSupplier(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteSupplier(
  id: string,
  ctx: AuditCtx
): Promise<{ ok: true; deactivated?: boolean; supplier?: Supplier }> {
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) throw new FieldError("Tedarikçi bulunamadı");
  if (await supplierHasLinks(before.name)) {
    const row = await prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
    const mapped = toSupplier(row);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "Supplier",
      entityId: id,
      summary: `Tedarikçi pasife alındı (bağlı kayıt): ${mapped.name}`,
      before: toSupplier(before),
      after: mapped,
      ipAddress: ctx.ip,
    });
    return { ok: true, deactivated: true, supplier: mapped };
  }
  await prisma.supplier.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "Supplier",
    entityId: id,
    summary: `Tedarikçi silindi: ${before.name}`,
    before: toSupplier(before),
    ipAddress: ctx.ip,
  });
  return { ok: true };
}

export async function dbCreatePersonnel(
  input: {
    firstName: string;
    lastName: string;
    department: string;
    title: string;
    email: string;
    phone: string;
    hireDate: string;
    salary: number;
    iban: string;
  },
  ctx: AuditCtx
): Promise<Personnel> {
  const data = {
    ...input,
    firstName: capitalizeWordsTr(input.firstName),
    lastName: capitalizeWordsTr(input.lastName),
    title: capitalizeWordsTr(input.title),
  };
  const row = await prisma.personnel.create({
    data: {
      id: `per-${Date.now()}`,
      ...data,
    },
  });
  const mapped = toPersonnel(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Personnel",
    entityId: mapped.id,
    summary: `Personel eklendi: ${mapped.firstName} ${mapped.lastName}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdatePersonnel(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    department: string;
    title: string;
    email: string;
    phone: string;
    hireDate: string;
    salary: number;
    iban: string;
  }>,
  ctx: AuditCtx
): Promise<Personnel> {
  const before = await prisma.personnel.findUnique({ where: { id } });
  if (!before) throw new FieldError("Personel bulunamadı");
  const data = {
    ...input,
    ...(input.firstName !== undefined
      ? { firstName: capitalizeWordsTr(input.firstName) }
      : {}),
    ...(input.lastName !== undefined
      ? { lastName: capitalizeWordsTr(input.lastName) }
      : {}),
    ...(input.title !== undefined
      ? { title: capitalizeWordsTr(input.title) }
      : {}),
  };
  const row = await prisma.personnel.update({ where: { id }, data });
  const mapped = toPersonnel(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Personnel",
    entityId: id,
    summary: `Personel güncellendi: ${mapped.firstName} ${mapped.lastName}`,
    before: toPersonnel(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeletePersonnel(id: string, ctx: AuditCtx): Promise<void> {
  const before = await prisma.personnel.findUnique({ where: { id } });
  if (!before) throw new FieldError("Personel bulunamadı");
  await prisma.personnel.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "Personnel",
    entityId: id,
    summary: `Personel silindi: ${before.firstName} ${before.lastName}`,
    before: toPersonnel(before),
    ipAddress: ctx.ip,
  });
}

type LineInput = {
  description: string;
  quantityLabel: string;
  unitPrice: number;
  lineTotal?: number;
};

function normalizeLines(lines: LineInput[]): Omit<InvoiceLine, "id" | "invoiceNo">[] {
  return lines.map((line) => ({
    description: line.description,
    quantityLabel: line.quantityLabel,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal ?? line.unitPrice,
  }));
}

export async function dbCreateInvoice(
  input: {
    invoiceNo: string;
    party: string;
    kind: string;
    issueDate: string;
    dueDate: string;
    amount?: number;
    status: string;
    lines?: LineInput[];
  },
  ctx: AuditCtx
): Promise<Invoice> {
  const invoiceNo = input.invoiceNo.trim();
  const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
  if (existing) throw new FieldError("Bu fatura numarası zaten kayıtlı");
  const lines = normalizeLines(input.lines ?? []);
  const amount =
    input.amount ??
    lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        id: `inv-${Date.now()}`,
        invoiceNo,
        party: input.party,
        kind: input.kind,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        amount,
        status: input.status,
      },
    });
    if (lines.length > 0) {
      await tx.invoiceLine.createMany({
        data: lines.map((line, i) => ({
          id: `inl-${Date.now()}-${i}`,
          invoiceNo,
          ...line,
        })),
      });
    }
    return created;
  });
  const mapped = toInvoice(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Invoice",
    entityId: mapped.id,
    summary: `Fatura eklendi: ${mapped.invoiceNo}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateInvoice(
  id: string,
  input: {
    invoiceNo?: string;
    party?: string;
    kind?: string;
    issueDate?: string;
    dueDate?: string;
    amount?: number;
    status?: string;
    lines?: LineInput[];
  },
  ctx: AuditCtx
): Promise<Invoice> {
  const before = await prisma.invoice.findUnique({ where: { id } });
  if (!before) throw new FieldError("Fatura bulunamadı");
  const invoiceNo = input.invoiceNo?.trim() ?? before.invoiceNo;
  if (invoiceNo !== before.invoiceNo) {
    const clash = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (clash) throw new FieldError("Bu fatura numarası zaten kayıtlı");
  }
  const lines = input.lines ? normalizeLines(input.lines) : undefined;
  const amount =
    input.amount ??
    (lines ? lines.reduce((sum, line) => sum + line.lineTotal, 0) : undefined);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        invoiceNo,
        ...(input.party !== undefined ? { party: input.party } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceNo } });
      if (lines.length > 0) {
        await tx.invoiceLine.createMany({
          data: lines.map((line, i) => ({
            id: `inl-${Date.now()}-${i}`,
            invoiceNo,
            ...line,
          })),
        });
      }
    }
    return updated;
  });
  const mapped = toInvoice(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Invoice",
    entityId: id,
    summary: `Fatura güncellendi: ${mapped.invoiceNo}`,
    before: toInvoice(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteInvoice(id: string, ctx: AuditCtx): Promise<void> {
  const before = await prisma.invoice.findUnique({ where: { id } });
  if (!before) throw new FieldError("Fatura bulunamadı");
  const linked = await prisma.rawMaterialOrder.count({
    where: { invoiceNo: before.invoiceNo },
  });
  if (linked > 0) {
    throw new ConflictError(
      "Bu faturaya bağlı hammadde siparişi var; fatura silinemez"
    );
  }
  await prisma.invoice.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "Invoice",
    entityId: id,
    summary: `Fatura silindi: ${before.invoiceNo}`,
    before: toInvoice(before),
    ipAddress: ctx.ip,
  });
}

export async function dbCreateLedger(
  input: {
    date: string;
    documentNo: string;
    description: string;
    category: string;
    direction: string;
    amount: number;
    status: string;
  },
  ctx: AuditCtx
): Promise<LedgerEntry> {
  const row = await prisma.ledgerEntry.create({
    data: { id: `led-${Date.now()}`, ...input },
  });
  const mapped = toLedger(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "LedgerEntry",
    entityId: mapped.id,
    summary: `Yevmiye eklendi: ${mapped.documentNo}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateLedger(
  id: string,
  input: Partial<{
    date: string;
    documentNo: string;
    description: string;
    category: string;
    direction: string;
    amount: number;
    status: string;
  }>,
  ctx: AuditCtx
): Promise<LedgerEntry> {
  const before = await prisma.ledgerEntry.findUnique({ where: { id } });
  if (!before) throw new FieldError("Yevmiye kaydı bulunamadı");
  const row = await prisma.ledgerEntry.update({ where: { id }, data: input });
  const mapped = toLedger(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "LedgerEntry",
    entityId: id,
    summary: `Yevmiye güncellendi: ${mapped.documentNo}`,
    before: toLedger(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteLedger(id: string, ctx: AuditCtx): Promise<void> {
  const before = await prisma.ledgerEntry.findUnique({ where: { id } });
  if (!before) throw new FieldError("Yevmiye kaydı bulunamadı");
  await prisma.ledgerEntry.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "LedgerEntry",
    entityId: id,
    summary: `Yevmiye silindi: ${before.documentNo}`,
    before: toLedger(before),
    ipAddress: ctx.ip,
  });
}

export async function dbCreateBudget(
  input: { department: string; annual: number; spent: number },
  ctx: AuditCtx
): Promise<BudgetRow> {
  const row = await prisma.budgetRow.create({
    data: { id: `bud-${Date.now()}`, ...input },
  });
  const mapped = toBudget(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "BudgetRow",
    entityId: mapped.id,
    summary: `Bütçe eklendi: ${mapped.department}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateBudget(
  id: string,
  input: Partial<{ department: string; annual: number; spent: number }>,
  ctx: AuditCtx
): Promise<BudgetRow> {
  const before = await prisma.budgetRow.findUnique({ where: { id } });
  if (!before) throw new FieldError("Bütçe satırı bulunamadı");
  const row = await prisma.budgetRow.update({ where: { id }, data: input });
  const mapped = toBudget(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "BudgetRow",
    entityId: id,
    summary: `Bütçe güncellendi: ${mapped.department}`,
    before: toBudget(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteBudget(id: string, ctx: AuditCtx): Promise<void> {
  const before = await prisma.budgetRow.findUnique({ where: { id } });
  if (!before) throw new FieldError("Bütçe satırı bulunamadı");
  await prisma.budgetRow.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "BudgetRow",
    entityId: id,
    summary: `Bütçe silindi: ${before.department}`,
    before: toBudget(before),
    ipAddress: ctx.ip,
  });
}
