import type {
  BudgetRow,
  Customer,
  DeliveryNote,
  DeliveryNoteLine,
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
import { normalizePersonnelTitle } from "@/lib/personnel";
import {
  serializeGuarantors,
  serializeRelatives,
  type SupplierGuarantor,
  type SupplierRelative,
} from "@/lib/supplier-card";
import {
  bucketFor,
  calcInvoiceLine,
  documentTypeFromKind,
  documentTypeMeta,
  isConfirmedDocument,
  storedInvoiceStatus,
} from "@/lib/invoice-docs";

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

export function toCustomer(row: {
  id: string;
  name: string;
  contact: string;
  address: string;
  taxNo: string;
  email: string;
  active: boolean;
  invoiceName: string;
  accountList: string;
  currency: string;
  accountCode: string;
  onlineTransactions: boolean;
  notes: string;
  iban: string;
  country: string;
  city: string;
  district: string;
  mobile: string;
  landline: string;
  accountKind: string;
  taxOffice: string;
  nationalId: string;
  openingBalance: unknown;
  openingBalanceType: string;
  paymentTermDays: number;
  creditLimit: unknown;
  salesPriceList: string;
  branch: string;
  assignedPersonnel: string;
  paymentTaxNo: string;
  relatives: string;
  guarantors: string;
}): Customer {
  return {
    ...row,
    openingBalance: asNumber(row.openingBalance),
    creditLimit: asNumber(row.creditLimit),
  };
}

export function toSupplier(row: {
  id: string;
  name: string;
  contact: string;
  address: string;
  active: boolean;
  invoiceName: string;
  accountList: string;
  currency: string;
  accountCode: string;
  onlineTransactions: boolean;
  notes: string;
  iban: string;
  country: string;
  city: string;
  district: string;
  mobile: string;
  email: string;
  landline: string;
  accountKind: string;
  taxNo: string;
  taxOffice: string;
  nationalId: string;
  openingBalance: unknown;
  openingBalanceType: string;
  paymentTermDays: number;
  creditLimit: unknown;
  salesPriceList: string;
  branch: string;
  assignedPersonnel: string;
  paymentTaxNo: string;
  relatives: string;
  guarantors: string;
}): Supplier {
  return {
    ...row,
    openingBalance: asNumber(row.openingBalance),
    creditLimit: asNumber(row.creditLimit),
  };
}

type SupplierWriteInput = {
  name: string;
  contact?: string;
  address?: string;
  invoiceName?: string;
  accountList?: string;
  currency?: string;
  accountCode?: string;
  onlineTransactions?: boolean;
  notes?: string;
  iban?: string;
  country?: string;
  city?: string;
  district?: string;
  mobile?: string;
  email?: string;
  landline?: string;
  accountKind?: string;
  taxNo?: string;
  taxOffice?: string;
  nationalId?: string;
  openingBalance?: number;
  openingBalanceType?: string;
  paymentTermDays?: number;
  creditLimit?: number;
  salesPriceList?: string;
  branch?: string;
  assignedPersonnel?: string;
  paymentTaxNo?: string;
  relatives?: SupplierRelative[];
  guarantors?: SupplierGuarantor[];
};

function supplierContact(input: SupplierWriteInput) {
  const mobile = input.mobile?.trim() ?? "";
  const landline = input.landline?.trim() ?? "";
  const contact = input.contact?.trim() ?? "";
  return contact || mobile || landline;
}

function partyWriteData(input: SupplierWriteInput, defaultAccountList: string) {
  const mobile = input.mobile?.trim() ?? "";
  const address = input.address?.trim() ?? "";
  return {
    name: input.name.trim(),
    contact: supplierContact(input),
    address,
    invoiceName: input.invoiceName?.trim() ?? "",
    accountList: input.accountList?.trim() || defaultAccountList,
    currency: input.currency?.trim() || "TL",
    accountCode: input.accountCode?.trim() ?? "",
    onlineTransactions: input.onlineTransactions ?? true,
    notes: input.notes?.trim() ?? "",
    iban: input.iban?.trim() ?? "",
    country: input.country?.trim() || "Türkiye",
    city: input.city?.trim() ?? "",
    district: input.district?.trim() ?? "",
    mobile,
    email: input.email?.trim() ?? "",
    landline: input.landline?.trim() ?? "",
    accountKind: input.accountKind?.trim() || "Gerçek kişi / Şahıs Firması",
    taxNo: input.taxNo?.trim() ?? "",
    taxOffice: input.taxOffice?.trim() ?? "",
    nationalId: input.nationalId?.trim() ?? "",
    openingBalance: input.openingBalance ?? 0,
    openingBalanceType: input.openingBalanceType?.trim() || "Borçlu",
    paymentTermDays: input.paymentTermDays ?? 0,
    creditLimit: input.creditLimit ?? 0,
    salesPriceList: input.salesPriceList?.trim() || "1. Satış Fiyatı",
    branch: input.branch?.trim() || "Merkez Şube",
    assignedPersonnel: input.assignedPersonnel?.trim() ?? "",
    paymentTaxNo: input.paymentTaxNo?.trim() ?? "",
    relatives: serializeRelatives(input.relatives ?? []),
    guarantors: serializeGuarantors(input.guarantors ?? []),
  };
}

function supplierWriteData(input: SupplierWriteInput) {
  return partyWriteData(input, "Tedarikçi");
}

function customerWriteData(input: SupplierWriteInput) {
  return partyWriteData(input, "Müşteri");
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

export function toInvoice(row: {
  id: string;
  invoiceNo: string;
  party: string;
  kind: string;
  issueDate: string;
  dueDate: string;
  amount: unknown;
  status: string;
  documentType: string;
  bucket: string;
  confirmed: boolean;
  eDocument: string;
  scenario: string;
  series: string;
  currency: string;
  fxRate: number;
  partyTaxNo: string;
  partyTaxOffice: string;
  partyAddress: string;
  partyCity: string;
  partyDistrict: string;
  partyPhone: string;
  partyEmail: string;
  sellerName: string;
  sellerTaxNo: string;
  sellerTaxOffice: string;
  sellerAddress: string;
  paymentMethod: string;
  relatedDispatchNo: string;
  relatedOrderNo: string;
  notes: string;
  validUntil?: string;
  deliveryTerm?: string;
  preparedBy?: string;
  subtotal: unknown;
  totalDiscount: unknown;
  totalVat: unknown;
  withholding: unknown;
  paidAmount?: unknown;
}): Invoice {
  const documentType = documentTypeFromKind(row.kind, row.documentType);
  return {
    ...row,
    documentType,
    bucket: bucketFor(documentType, row.bucket),
    amount: asNumber(row.amount),
    subtotal: asNumber(row.subtotal),
    totalDiscount: asNumber(row.totalDiscount),
    totalVat: asNumber(row.totalVat),
    withholding: asNumber(row.withholding),
    paidAmount: asNumber((row as { paidAmount?: unknown }).paidAmount),
    validUntil: row.validUntil ?? "",
    deliveryTerm: row.deliveryTerm ?? "",
    preparedBy: row.preparedBy ?? "",
  };
}

export function toInvoiceLine(row: {
  id: string;
  invoiceNo: string;
  description: string;
  quantityLabel: string;
  unitPrice: unknown;
  lineTotal: unknown;
  quantity: number;
  unit: string;
  discountRate: number;
  vatRate: number;
  vatAmount: unknown;
  lineNet: unknown;
}): InvoiceLine {
  return {
    ...row,
    unitPrice: asNumber(row.unitPrice),
    lineTotal: asNumber(row.lineTotal),
    vatAmount: asNumber(row.vatAmount),
    lineNet: asNumber(row.lineNet),
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
  input: SupplierWriteInput,
  ctx: AuditCtx
): Promise<Customer> {
  const data = customerWriteData(input);
  const row = await prisma.customer.create({
    data: {
      id: `cus-${Date.now()}`,
      ...data,
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
  input: Partial<SupplierWriteInput> & { active?: boolean },
  ctx: AuditCtx
): Promise<Customer> {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw new FieldError("Müşteri bulunamadı");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.contact !== undefined) patch.contact = input.contact.trim();
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.active !== undefined) patch.active = input.active;
  if (input.invoiceName !== undefined) patch.invoiceName = input.invoiceName.trim();
  if (input.accountList !== undefined) patch.accountList = input.accountList.trim() || "Müşteri";
  if (input.currency !== undefined) patch.currency = input.currency.trim() || "TL";
  if (input.accountCode !== undefined) patch.accountCode = input.accountCode.trim();
  if (input.onlineTransactions !== undefined) {
    patch.onlineTransactions = input.onlineTransactions;
  }
  if (input.notes !== undefined) patch.notes = input.notes.trim();
  if (input.iban !== undefined) patch.iban = input.iban.trim();
  if (input.country !== undefined) patch.country = input.country.trim() || "Türkiye";
  if (input.city !== undefined) patch.city = input.city.trim();
  if (input.district !== undefined) patch.district = input.district.trim();
  if (input.mobile !== undefined) patch.mobile = input.mobile.trim();
  if (input.email !== undefined) patch.email = input.email.trim();
  if (input.landline !== undefined) patch.landline = input.landline.trim();
  if (input.accountKind !== undefined) {
    patch.accountKind = input.accountKind.trim() || "Gerçek kişi / Şahıs Firması";
  }
  if (input.taxNo !== undefined) patch.taxNo = input.taxNo.trim();
  if (input.taxOffice !== undefined) patch.taxOffice = input.taxOffice.trim();
  if (input.nationalId !== undefined) patch.nationalId = input.nationalId.trim();
  if (input.openingBalance !== undefined) patch.openingBalance = input.openingBalance;
  if (input.openingBalanceType !== undefined) {
    patch.openingBalanceType = input.openingBalanceType.trim() || "Borçlu";
  }
  if (input.paymentTermDays !== undefined) patch.paymentTermDays = input.paymentTermDays;
  if (input.creditLimit !== undefined) patch.creditLimit = input.creditLimit;
  if (input.salesPriceList !== undefined) {
    patch.salesPriceList = input.salesPriceList.trim() || "1. Satış Fiyatı";
  }
  if (input.branch !== undefined) patch.branch = input.branch.trim() || "Merkez Şube";
  if (input.assignedPersonnel !== undefined) {
    patch.assignedPersonnel = input.assignedPersonnel.trim();
  }
  if (input.paymentTaxNo !== undefined) patch.paymentTaxNo = input.paymentTaxNo.trim();
  if (input.relatives !== undefined) patch.relatives = serializeRelatives(input.relatives);
  if (input.guarantors !== undefined) {
    patch.guarantors = serializeGuarantors(input.guarantors);
  }
  if (input.mobile !== undefined || input.landline !== undefined || input.contact !== undefined) {
    patch.contact = supplierContact({
      name: input.name ?? before.name,
      contact: input.contact ?? before.contact,
      mobile: input.mobile ?? before.mobile,
      landline: input.landline ?? before.landline,
    });
  }
  const row = await prisma.customer.update({
    where: { id },
    data: patch,
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
  input: SupplierWriteInput,
  ctx: AuditCtx
): Promise<Supplier> {
  const data = supplierWriteData(input);
  const row = await prisma.supplier.create({
    data: {
      id: `sup-${Date.now()}`,
      ...data,
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
  input: Partial<SupplierWriteInput> & { active?: boolean },
  ctx: AuditCtx
): Promise<Supplier> {
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) throw new FieldError("Tedarikçi bulunamadı");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.contact !== undefined) patch.contact = input.contact.trim();
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.active !== undefined) patch.active = input.active;
  if (input.invoiceName !== undefined) patch.invoiceName = input.invoiceName.trim();
  if (input.accountList !== undefined) patch.accountList = input.accountList.trim() || "Tedarikçi";
  if (input.currency !== undefined) patch.currency = input.currency.trim() || "TL";
  if (input.accountCode !== undefined) patch.accountCode = input.accountCode.trim();
  if (input.onlineTransactions !== undefined) {
    patch.onlineTransactions = input.onlineTransactions;
  }
  if (input.notes !== undefined) patch.notes = input.notes.trim();
  if (input.iban !== undefined) patch.iban = input.iban.trim();
  if (input.country !== undefined) patch.country = input.country.trim() || "Türkiye";
  if (input.city !== undefined) patch.city = input.city.trim();
  if (input.district !== undefined) patch.district = input.district.trim();
  if (input.mobile !== undefined) patch.mobile = input.mobile.trim();
  if (input.email !== undefined) patch.email = input.email.trim();
  if (input.landline !== undefined) patch.landline = input.landline.trim();
  if (input.accountKind !== undefined) {
    patch.accountKind = input.accountKind.trim() || "Gerçek kişi / Şahıs Firması";
  }
  if (input.taxNo !== undefined) patch.taxNo = input.taxNo.trim();
  if (input.taxOffice !== undefined) patch.taxOffice = input.taxOffice.trim();
  if (input.nationalId !== undefined) patch.nationalId = input.nationalId.trim();
  if (input.openingBalance !== undefined) patch.openingBalance = input.openingBalance;
  if (input.openingBalanceType !== undefined) {
    patch.openingBalanceType = input.openingBalanceType.trim() || "Borçlu";
  }
  if (input.paymentTermDays !== undefined) patch.paymentTermDays = input.paymentTermDays;
  if (input.creditLimit !== undefined) patch.creditLimit = input.creditLimit;
  if (input.salesPriceList !== undefined) {
    patch.salesPriceList = input.salesPriceList.trim() || "1. Satış Fiyatı";
  }
  if (input.branch !== undefined) patch.branch = input.branch.trim() || "Merkez Şube";
  if (input.assignedPersonnel !== undefined) {
    patch.assignedPersonnel = input.assignedPersonnel.trim();
  }
  if (input.paymentTaxNo !== undefined) patch.paymentTaxNo = input.paymentTaxNo.trim();
  if (input.relatives !== undefined) patch.relatives = serializeRelatives(input.relatives);
  if (input.guarantors !== undefined) {
    patch.guarantors = serializeGuarantors(input.guarantors);
  }
  if (input.mobile !== undefined || input.landline !== undefined || input.contact !== undefined) {
    patch.contact = supplierContact({
      name: input.name ?? before.name,
      contact: input.contact ?? before.contact,
      mobile: input.mobile ?? before.mobile,
      landline: input.landline ?? before.landline,
    });
  }
  const row = await prisma.supplier.update({
    where: { id },
    data: patch,
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
    title: normalizePersonnelTitle(input.title),
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
      ? { title: normalizePersonnelTitle(input.title) }
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
  quantityLabel?: string;
  unitPrice: number;
  lineTotal?: number;
  quantity?: number;
  unit?: string;
  discountRate?: number;
  vatRate?: number;
  vatAmount?: number;
  lineNet?: number;
};

function normalizeLines(lines: LineInput[]): Omit<InvoiceLine, "id" | "invoiceNo">[] {
  return lines.map((line) => {
    const unit = line.unit?.trim() || "Adet";
    const quantity =
      line.quantity ??
      parseFloat(String(line.quantityLabel ?? "1").replace(",", ".")) ??
      1;
    const calc = calcInvoiceLine(
      {
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitPrice: line.unitPrice,
        discountRate: line.discountRate ?? 0,
        vatRate: line.vatRate ?? 20,
      },
      unit
    );
    return {
      description: line.description,
      quantityLabel: line.quantityLabel?.trim() || calc.quantityLabel,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal ?? calc.lineTotal,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit,
      discountRate: line.discountRate ?? 0,
      vatRate: line.vatRate ?? 20,
      vatAmount: line.vatAmount ?? calc.vatAmount,
      lineNet: line.lineNet ?? calc.lineNet,
    };
  });
}

type InvoiceWriteInput = {
  invoiceNo: string;
  party: string;
  kind?: string;
  issueDate: string;
  dueDate: string;
  amount?: number;
  status: string;
  documentType?: string;
  bucket?: string;
  confirmed?: boolean;
  eDocument?: string;
  scenario?: string;
  series?: string;
  currency?: string;
  fxRate?: number;
  partyTaxNo?: string;
  partyTaxOffice?: string;
  partyAddress?: string;
  partyCity?: string;
  partyDistrict?: string;
  partyPhone?: string;
  partyEmail?: string;
  sellerName?: string;
  sellerTaxNo?: string;
  sellerTaxOffice?: string;
  sellerAddress?: string;
  paymentMethod?: string;
  relatedDispatchNo?: string;
  relatedOrderNo?: string;
  notes?: string;
  validUntil?: string;
  deliveryTerm?: string;
  preparedBy?: string;
  subtotal?: number;
  totalDiscount?: number;
  totalVat?: number;
  withholding?: number;
  lines?: LineInput[];
};

function invoiceHeaderFromInput(input: InvoiceWriteInput, lines: Omit<InvoiceLine, "id" | "invoiceNo">[]) {
  const documentType = documentTypeFromKind(input.kind ?? "", input.documentType);
  const meta = documentTypeMeta(documentType);
  const kind = input.kind?.trim() || meta.kind;
  const status = storedInvoiceStatus(input.status.trim(), documentType);
  const subtotal = input.subtotal ?? lines.reduce((s, l) => s + l.lineNet, 0);
  const totalVat = input.totalVat ?? lines.reduce((s, l) => s + l.vatAmount, 0);
  const amount =
    input.amount ??
    lines.reduce((s, l) => s + l.lineTotal, 0);
  return {
    documentType,
    bucket: bucketFor(documentType, input.bucket),
    kind,
    status,
    confirmed: input.confirmed ?? isConfirmedDocument(status, documentType),
    eDocument: input.eDocument?.trim() || (meta.bucket === "proforma" ? "Proforma" : "e-Arşiv"),
    scenario: input.scenario?.trim() || "TEMELFATURA",
    series: input.series?.trim() ?? "",
    currency: input.currency?.trim() || "TRY",
    fxRate: input.fxRate ?? 1,
    partyTaxNo: input.partyTaxNo?.trim() ?? "",
    partyTaxOffice: input.partyTaxOffice?.trim() ?? "",
    partyAddress: input.partyAddress?.trim() ?? "",
    partyCity: input.partyCity?.trim() ?? "",
    partyDistrict: input.partyDistrict?.trim() ?? "",
    partyPhone: input.partyPhone?.trim() ?? "",
    partyEmail: input.partyEmail?.trim() ?? "",
    sellerName: input.sellerName?.trim() || "HamdPharma",
    sellerTaxNo: input.sellerTaxNo?.trim() ?? "",
    sellerTaxOffice: input.sellerTaxOffice?.trim() ?? "",
    sellerAddress: input.sellerAddress?.trim() ?? "",
    paymentMethod: input.paymentMethod?.trim() || "Cari hesap",
    relatedDispatchNo: input.relatedDispatchNo?.trim() ?? "",
    relatedOrderNo: input.relatedOrderNo?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    validUntil: input.validUntil?.trim() ?? "",
    deliveryTerm: input.deliveryTerm?.trim() ?? "",
    preparedBy: input.preparedBy?.trim() ?? "",
    subtotal,
    totalDiscount: input.totalDiscount ?? 0,
    totalVat,
    withholding: input.withholding ?? 0,
    amount,
  };
}

export async function dbCreateInvoice(
  input: InvoiceWriteInput,
  ctx: AuditCtx
): Promise<Invoice> {
  const invoiceNo = input.invoiceNo.trim();
  const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
  if (existing) throw new FieldError("Bu fatura numarası zaten kayıtlı");
  const lines = normalizeLines(input.lines ?? []);
  const header = invoiceHeaderFromInput(input, lines);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        id: `inv-${Date.now()}`,
        invoiceNo,
        party: input.party,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        ...header,
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

/** invoiceUpdateSchema .default() ile doldurduğu değerler. İstekte yok sayılır. */
const INVOICE_PATCH_DEFAULTS: Record<string, string> = {
  kind: "Satış",
  documentType: "",
  bucket: "",
  eDocument: "e-Arşiv",
  scenario: "TEMELFATURA",
  series: "",
  currency: "TRY",
  partyTaxNo: "",
  partyTaxOffice: "",
  partyAddress: "",
  partyCity: "",
  partyDistrict: "",
  partyPhone: "",
  partyEmail: "",
  sellerName: "HamdPharma",
  sellerTaxNo: "",
  sellerTaxOffice: "",
  sellerAddress: "",
  paymentMethod: "Cari hesap",
  relatedDispatchNo: "",
  relatedOrderNo: "",
  notes: "",
  validUntil: "",
  deliveryTerm: "",
  preparedBy: "",
};

function explicitInvoicePatchKeys(input: Partial<InvoiceWriteInput>): string[] {
  return Object.keys(input).filter((key) => {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) return false;
    return INVOICE_PATCH_DEFAULTS[key] !== value;
  });
}

export async function dbUpdateInvoice(
  id: string,
  input: Partial<InvoiceWriteInput>,
  ctx: AuditCtx
): Promise<Invoice> {
  const before = await prisma.invoice.findUnique({ where: { id } });
  if (!before) throw new FieldError("Fatura bulunamadı");
  if (documentTypeFromKind(before.kind, before.documentType) === "quote") {
    const keys = explicitInvoicePatchKeys(input);
    if (keys.some((key) => key !== "status")) {
      throw new FieldError(
        "Fiyat teklifi oluşturulduktan sonra yalnızca durum güncellenebilir"
      );
    }
    if (!input.status?.trim()) throw new FieldError("Durum zorunludur");
    const status = storedInvoiceStatus(input.status, "quote");
    const row = await prisma.invoice.update({
      where: { id },
      data: { status },
    });
    const mapped = toInvoice(row);
    await logAudit({
      actor: ctx.actor,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      summary: `Teklif durumu güncellendi: ${mapped.invoiceNo} → ${status}`,
      before: toInvoice(before),
      after: mapped,
      ipAddress: ctx.ip,
    });
    return mapped;
  }
  const invoiceNo = input.invoiceNo?.trim() ?? before.invoiceNo;
  if (invoiceNo !== before.invoiceNo) {
    const clash = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (clash) throw new FieldError("Bu fatura numarası zaten kayıtlı");
  }
  const lines = input.lines ? normalizeLines(input.lines) : undefined;
  const merged: InvoiceWriteInput = {
    invoiceNo,
    party: input.party ?? before.party,
    kind: input.kind ?? before.kind,
    issueDate: input.issueDate ?? before.issueDate,
    dueDate: input.dueDate ?? before.dueDate,
    amount: input.amount,
    status: input.status ?? before.status,
    documentType: input.documentType ?? before.documentType,
    bucket: input.bucket ?? before.bucket,
    confirmed: input.confirmed,
    eDocument: input.eDocument ?? before.eDocument,
    scenario: input.scenario ?? before.scenario,
    series: input.series ?? before.series,
    currency: input.currency ?? before.currency,
    fxRate: input.fxRate ?? before.fxRate,
    partyTaxNo: input.partyTaxNo ?? before.partyTaxNo,
    partyTaxOffice: input.partyTaxOffice ?? before.partyTaxOffice,
    partyAddress: input.partyAddress ?? before.partyAddress,
    partyCity: input.partyCity ?? before.partyCity,
    partyDistrict: input.partyDistrict ?? before.partyDistrict,
    partyPhone: input.partyPhone ?? before.partyPhone,
    partyEmail: input.partyEmail ?? before.partyEmail,
    sellerName: input.sellerName ?? before.sellerName,
    sellerTaxNo: input.sellerTaxNo ?? before.sellerTaxNo,
    sellerTaxOffice: input.sellerTaxOffice ?? before.sellerTaxOffice,
    sellerAddress: input.sellerAddress ?? before.sellerAddress,
    paymentMethod: input.paymentMethod ?? before.paymentMethod,
    relatedDispatchNo: input.relatedDispatchNo ?? before.relatedDispatchNo,
    relatedOrderNo: input.relatedOrderNo ?? before.relatedOrderNo,
    notes: input.notes ?? before.notes,
    validUntil: input.validUntil ?? before.validUntil,
    deliveryTerm: input.deliveryTerm ?? before.deliveryTerm,
    preparedBy: input.preparedBy ?? before.preparedBy,
    subtotal: input.subtotal,
    totalDiscount: input.totalDiscount,
    totalVat: input.totalVat,
    withholding: input.withholding,
    lines: input.lines,
  };
  const header = invoiceHeaderFromInput(merged, lines ?? []);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        invoiceNo,
        party: merged.party,
        issueDate: merged.issueDate,
        dueDate: merged.dueDate,
        ...header,
        ...(lines
          ? {}
          : {
              amount: input.amount ?? before.amount,
              subtotal: input.subtotal ?? before.subtotal,
              totalVat: input.totalVat ?? before.totalVat,
              totalDiscount: input.totalDiscount ?? before.totalDiscount,
              withholding: input.withholding ?? before.withholding,
            }),
      },
    });
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceNo: before.invoiceNo } });
      if (lines.length > 0) {
        await tx.invoiceLine.createMany({
          data: lines.map((line, i) => ({
            id: `inl-${Date.now()}-${i}`,
            invoiceNo,
            ...line,
          })),
        });
      }
    } else if (invoiceNo !== before.invoiceNo) {
      await tx.invoiceLine.updateMany({
        where: { invoiceNo: before.invoiceNo },
        data: { invoiceNo },
      });
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

type DeliveryLineInput = {
  description: string;
  quantityLabel: string;
  unit: string;
};

export function toDeliveryNote(row: {
  id: string;
  noteNo: string;
  party: string;
  kind: string;
  issueDate: string;
  shipDate: string;
  warehouse: string;
  relatedOrderNo: string;
  relatedInvoiceNo: string;
  status: string;
  partyTaxNo?: string;
  partyAddress?: string;
  partyCity?: string;
  partyDistrict?: string;
  partyCountry?: string;
  partyPostalCode?: string;
  driverName?: string;
  driverNationalId?: string;
  plateNo?: string;
  trailerPlate?: string;
  plateOrigin?: string;
  shipMethod?: string;
  dispatchAddress?: string;
  issueTime?: string;
  shipTime?: string;
  relatedOrderDate?: string;
  packages?: string;
  notes?: string;
}): DeliveryNote {
  return {
    id: row.id,
    noteNo: row.noteNo,
    party: row.party,
    kind: row.kind,
    issueDate: row.issueDate,
    shipDate: row.shipDate,
    warehouse: row.warehouse,
    relatedOrderNo: row.relatedOrderNo,
    relatedInvoiceNo: row.relatedInvoiceNo,
    status: row.status,
    partyTaxNo: row.partyTaxNo ?? "",
    partyAddress: row.partyAddress ?? "",
    partyCity: row.partyCity ?? "",
    partyDistrict: row.partyDistrict ?? "",
    partyCountry: row.partyCountry || "Türkiye",
    partyPostalCode: row.partyPostalCode ?? "",
    driverName: row.driverName ?? "",
    driverNationalId: row.driverNationalId ?? "",
    plateNo: row.plateNo ?? "",
    trailerPlate: row.trailerPlate ?? "",
    plateOrigin: row.plateOrigin || "Türkiye plaka",
    shipMethod: row.shipMethod || "Kendi aracımla gönderiyorum",
    dispatchAddress: row.dispatchAddress ?? "",
    issueTime: row.issueTime ?? "",
    shipTime: row.shipTime ?? "",
    relatedOrderDate: row.relatedOrderDate ?? "",
    packages: row.packages ?? "",
    notes: row.notes ?? "",
  };
}

function normalizeDeliveryLines(
  lines: DeliveryLineInput[]
): Omit<DeliveryNoteLine, "id" | "noteNo">[] {
  return lines.map((line) => ({
    description: line.description,
    quantityLabel: line.quantityLabel,
    unit: line.unit,
  }));
}

type DeliveryNoteWriteInput = {
  noteNo: string;
  party: string;
  kind: string;
  issueDate: string;
  shipDate: string;
  warehouse: string;
  relatedOrderNo?: string;
  relatedInvoiceNo?: string;
  status: string;
  partyTaxNo?: string;
  partyAddress?: string;
  partyCity?: string;
  partyDistrict?: string;
  partyCountry?: string;
  partyPostalCode?: string;
  driverName?: string;
  driverNationalId?: string;
  plateNo?: string;
  trailerPlate?: string;
  plateOrigin?: string;
  shipMethod?: string;
  dispatchAddress?: string;
  issueTime?: string;
  shipTime?: string;
  relatedOrderDate?: string;
  packages?: string;
  notes?: string;
  lines?: DeliveryLineInput[];
};

function deliveryExtras(input: Partial<DeliveryNoteWriteInput>) {
  return {
    relatedOrderNo: input.relatedOrderNo?.trim() ?? "",
    relatedInvoiceNo: input.relatedInvoiceNo?.trim() ?? "",
    relatedOrderDate: input.relatedOrderDate?.trim() ?? "",
    partyTaxNo: input.partyTaxNo?.trim() ?? "",
    partyAddress: input.partyAddress?.trim() ?? "",
    partyCity: input.partyCity?.trim() ?? "",
    partyDistrict: input.partyDistrict?.trim() ?? "",
    partyCountry: input.partyCountry?.trim() || "Türkiye",
    partyPostalCode: input.partyPostalCode?.trim() ?? "",
    driverName: input.driverName?.trim() ?? "",
    driverNationalId: input.driverNationalId?.trim() ?? "",
    plateNo: input.plateNo?.trim() ?? "",
    trailerPlate: input.trailerPlate?.trim() ?? "",
    plateOrigin: input.plateOrigin?.trim() || "Türkiye plaka",
    shipMethod: input.shipMethod?.trim() || "Kendi aracımla gönderiyorum",
    dispatchAddress: input.dispatchAddress?.trim() ?? "",
    issueTime: input.issueTime?.trim() ?? "",
    shipTime: input.shipTime?.trim() ?? "",
    packages: input.packages?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  };
}

export async function dbCreateDeliveryNote(
  input: DeliveryNoteWriteInput,
  ctx: AuditCtx
): Promise<DeliveryNote> {
  const noteNo = input.noteNo.trim();
  const existing = await prisma.deliveryNote.findUnique({ where: { noteNo } });
  if (existing) throw new FieldError("Bu irsaliye numarası zaten kayıtlı");
  const lines = normalizeDeliveryLines(input.lines ?? []);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.deliveryNote.create({
      data: {
        id: `dn-${Date.now()}`,
        noteNo,
        party: input.party,
        kind: input.kind,
        issueDate: input.issueDate,
        shipDate: input.shipDate,
        warehouse: input.warehouse,
        status: input.status,
        ...deliveryExtras(input),
      },
    });
    if (lines.length > 0) {
      await tx.deliveryNoteLine.createMany({
        data: lines.map((line, i) => ({
          id: `dnl-${Date.now()}-${i}`,
          noteNo,
          ...line,
        })),
      });
    }
    return created;
  });
  const mapped = toDeliveryNote(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "DeliveryNote",
    entityId: mapped.id,
    summary: `İrsaliye eklendi: ${mapped.noteNo}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbUpdateDeliveryNote(
  id: string,
  input: Partial<DeliveryNoteWriteInput>,
  ctx: AuditCtx
): Promise<DeliveryNote> {
  const before = await prisma.deliveryNote.findUnique({ where: { id } });
  if (!before) throw new FieldError("İrsaliye bulunamadı");
  const noteNo = input.noteNo?.trim() ?? before.noteNo;
  if (noteNo !== before.noteNo) {
    const clash = await prisma.deliveryNote.findUnique({ where: { noteNo } });
    if (clash) throw new FieldError("Bu irsaliye numarası zaten kayıtlı");
  }
  const lines = input.lines ? normalizeDeliveryLines(input.lines) : undefined;
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.deliveryNote.update({
      where: { id },
      data: {
        noteNo,
        ...(input.party !== undefined ? { party: input.party } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
        ...(input.shipDate !== undefined ? { shipDate: input.shipDate } : {}),
        ...(input.warehouse !== undefined ? { warehouse: input.warehouse } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.relatedOrderNo !== undefined
          ? { relatedOrderNo: input.relatedOrderNo.trim() }
          : {}),
        ...(input.relatedInvoiceNo !== undefined
          ? { relatedInvoiceNo: input.relatedInvoiceNo.trim() }
          : {}),
        ...(input.partyTaxNo !== undefined ? { partyTaxNo: input.partyTaxNo.trim() } : {}),
        ...(input.partyAddress !== undefined
          ? { partyAddress: input.partyAddress.trim() }
          : {}),
        ...(input.partyCity !== undefined ? { partyCity: input.partyCity.trim() } : {}),
        ...(input.partyDistrict !== undefined ? { partyDistrict: input.partyDistrict.trim() } : {}),
        ...(input.partyCountry !== undefined ? { partyCountry: input.partyCountry.trim() } : {}),
        ...(input.partyPostalCode !== undefined ? { partyPostalCode: input.partyPostalCode.trim() } : {}),
        ...(input.driverName !== undefined ? { driverName: input.driverName.trim() } : {}),
        ...(input.driverNationalId !== undefined
          ? { driverNationalId: input.driverNationalId.trim() }
          : {}),
        ...(input.plateNo !== undefined ? { plateNo: input.plateNo.trim() } : {}),
        ...(input.trailerPlate !== undefined ? { trailerPlate: input.trailerPlate.trim() } : {}),
        ...(input.plateOrigin !== undefined ? { plateOrigin: input.plateOrigin.trim() } : {}),
        ...(input.shipMethod !== undefined ? { shipMethod: input.shipMethod.trim() } : {}),
        ...(input.dispatchAddress !== undefined
          ? { dispatchAddress: input.dispatchAddress.trim() }
          : {}),
        ...(input.issueTime !== undefined ? { issueTime: input.issueTime.trim() } : {}),
        ...(input.shipTime !== undefined ? { shipTime: input.shipTime.trim() } : {}),
        ...(input.relatedOrderDate !== undefined
          ? { relatedOrderDate: input.relatedOrderDate.trim() }
          : {}),
        ...(input.packages !== undefined ? { packages: input.packages.trim() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      },
    });
    if (lines) {
      await tx.deliveryNoteLine.deleteMany({ where: { noteNo } });
      if (lines.length > 0) {
        await tx.deliveryNoteLine.createMany({
          data: lines.map((line, i) => ({
            id: `dnl-${Date.now()}-${i}`,
            noteNo,
            ...line,
          })),
        });
      }
    }
    return updated;
  });
  const mapped = toDeliveryNote(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "DeliveryNote",
    entityId: id,
    summary: `İrsaliye güncellendi: ${mapped.noteNo}`,
    before: toDeliveryNote(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function dbDeleteDeliveryNote(
  id: string,
  ctx: AuditCtx
): Promise<void> {
  const before = await prisma.deliveryNote.findUnique({ where: { id } });
  if (!before) throw new FieldError("İrsaliye bulunamadı");
  await prisma.deliveryNote.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "DeliveryNote",
    entityId: id,
    summary: `İrsaliye silindi: ${before.noteNo}`,
    before: toDeliveryNote(before),
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
