import path from "path";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { prisma } from "@/lib/db";
import { FieldError } from "@/lib/server/fields";
import type { InvoiceEvent } from "@/data/catalog";
import {
  isConfirmedWorkflow,
  normalizeInvoiceStatus,
  paymentStatusFor,
  type InvoiceWorkflowStatus,
} from "@/lib/invoice-docs";
import {
  applyInstallmentsToPayment,
  releaseInstallmentsByPayment,
} from "@/lib/server/cheque-notes";


export const INVOICE_DOC_MAX_BYTES = 5 * 1024 * 1024;
export const INVOICE_DOC_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    try {
      return Number((value as { toNumber: () => number }).toNumber());
    } catch {
      return 0;
    }
  }
  return 0;
}

function docsDir() {
  return path.resolve(process.cwd(), "uploads", "invoice-docs");
}

export function invoiceDocPath(fileId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(fileId) || fileId.includes("..")) {
    throw new FieldError("Geçersiz dosya");
  }
  return path.join(docsDir(), fileId);
}

function extForMime(mime: string, originalName: string) {
  const fromName = path.extname(originalName).toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(fromName)) return fromName;
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function toEvent(row: Record<string, unknown>): InvoiceEvent {
  const kind = row.kind === "payment" ? "payment" : "status";
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt ?? "");
  return {
    id: String(row.id ?? ""),
    invoiceNo: String(row.invoiceNo ?? ""),
    kind,
    status: String(row.status ?? ""),
    amount: asNumber(row.amount),
    method: String(row.method ?? ""),
    note: String(row.note ?? ""),
    fileName: String(row.fileName ?? ""),
    fileId: String(row.fileId ?? ""),
    mimeType: String(row.mimeType ?? ""),
    createdAt,
    createdBy: String(row.createdBy ?? ""),
  };
}

export async function listInvoiceEvents(invoiceNo: string): Promise<InvoiceEvent[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "InvoiceEvent"
    WHERE "invoiceNo" = ${invoiceNo}
    ORDER BY "createdAt" DESC
  `;
  return rows.map(toEvent);
}

export async function listAllInvoiceEvents(): Promise<InvoiceEvent[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "InvoiceEvent"
    ORDER BY "createdAt" DESC
  `;
  return rows.map(toEvent);
}

export async function getInvoiceEvent(id: string): Promise<InvoiceEvent | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "InvoiceEvent" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function getInvoiceEventByFileId(fileId: string): Promise<InvoiceEvent | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "InvoiceEvent" WHERE "fileId" = ${fileId} LIMIT 1
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

async function paymentSum(invoiceNo: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total: unknown }>>`
    SELECT COALESCE(SUM("amount"), 0) AS total
    FROM "InvoiceEvent"
    WHERE "invoiceNo" = ${invoiceNo} AND "kind" = 'payment'
  `;
  return asNumber(rows[0]?.total);
}

async function updateInvoiceWorkflow(
  invoiceNo: string,
  status: InvoiceWorkflowStatus,
  paidAmount: number
) {
  const confirmed = isConfirmedWorkflow(status);
  await prisma.$executeRaw`
    UPDATE "Invoice"
    SET "status" = ${status},
        "confirmed" = ${confirmed},
        "paidAmount" = ${paidAmount}
    WHERE "invoiceNo" = ${invoiceNo}
  `;
}

export async function saveInvoiceDocFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<{ fileId: string; fileName: string; mimeType: string }> {
  if (!INVOICE_DOC_MIMES.has(input.mimeType)) {
    throw new FieldError("Yalnızca PDF, PNG veya JPEG yüklenebilir");
  }
  if (input.buffer.byteLength > INVOICE_DOC_MAX_BYTES) {
    throw new FieldError("Dosya 5 MB altında olmalıdır");
  }
  await mkdir(docsDir(), { recursive: true });
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extForMime(input.mimeType, input.originalName)}`;
  await writeFile(invoiceDocPath(fileId), input.buffer);
  return {
    fileId,
    fileName: path.basename(input.originalName).slice(0, 180) || fileId,
    mimeType: input.mimeType,
  };
}

export async function readInvoiceDocFile(fileId: string) {
  return readFile(invoiceDocPath(fileId));
}

export async function addInvoiceStatusEvent(input: {
  invoiceNo: string;
  status: string;
  note: string;
  createdBy: string;
  file?: { buffer: Buffer; mimeType: string; originalName: string };
}): Promise<InvoiceEvent> {
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNo: input.invoiceNo } });
  if (!invoice) throw new FieldError("Fatura bulunamadı");
  const status = normalizeInvoiceStatus(input.status);
  const paid = asNumber((invoice as { paidAmount?: unknown }).paidAmount);
  const file = input.file ? await saveInvoiceDocFile(input.file) : { fileId: "", fileName: "", mimeType: "" };
  const id = `iev-${Date.now()}`;
  await prisma.$executeRaw`
    INSERT INTO "InvoiceEvent" (
      "id", "invoiceNo", "kind", "status", "amount", "method", "note",
      "fileName", "fileId", "mimeType", "createdAt", "createdBy"
    ) VALUES (
      ${id}, ${input.invoiceNo}, 'status', ${status}, 0, '', ${input.note.trim()},
      ${file.fileName}, ${file.fileId}, ${file.mimeType}, CURRENT_TIMESTAMP, ${input.createdBy}
    )
  `;
  const paidAmount = status === "Ödendi" && paid <= 0.009 ? asNumber(invoice.amount) : paid;
  await updateInvoiceWorkflow(input.invoiceNo, status, paidAmount);
  const created = await getInvoiceEvent(id);
  if (!created) throw new FieldError("Durum kaydı oluşturulamadı");
  return created;
}

export async function addInvoicePaymentEvent(input: {
  invoiceNo: string;
  amount: number;
  method: string;
  note: string;
  createdBy: string;
  file?: { buffer: Buffer; mimeType: string; originalName: string };
  installmentIds?: string[];
}): Promise<InvoiceEvent> {
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNo: input.invoiceNo } });
  if (!invoice) throw new FieldError("Fatura bulunamadı");
  const installmentIds = [...new Set((input.installmentIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const id = `iev-${Date.now()}`;
  let amount = input.amount;
  if (installmentIds.length > 0) {
    amount = await applyInstallmentsToPayment({
      installmentIds,
      invoiceNo: input.invoiceNo,
      paymentEventId: id,
    });
  }
  if (!(amount > 0)) {
    if (installmentIds.length > 0) await releaseInstallmentsByPayment(id);
    throw new FieldError("Ödeme tutarı pozitif olmalıdır");
  }
  const currentPaid = await paymentSum(input.invoiceNo);
  const nextPaid = Math.round((currentPaid + amount) * 100) / 100;
  const total = asNumber(invoice.amount);
  if (nextPaid - total > 0.05) {
    if (installmentIds.length > 0) await releaseInstallmentsByPayment(id);
    throw new FieldError("Ödeme tutarı fatura bakiyesini aşıyor");
  }
  const status = paymentStatusFor(total, nextPaid);
  const file = input.file ? await saveInvoiceDocFile(input.file) : { fileId: "", fileName: "", mimeType: "" };
  try {
    await prisma.$executeRaw`
      INSERT INTO "InvoiceEvent" (
        "id", "invoiceNo", "kind", "status", "amount", "method", "note",
        "fileName", "fileId", "mimeType", "createdAt", "createdBy"
      ) VALUES (
        ${id}, ${input.invoiceNo}, 'payment', ${status}, ${amount}, ${input.method.trim() || "Havale / EFT"},
        ${input.note.trim()}, ${file.fileName}, ${file.fileId}, ${file.mimeType}, CURRENT_TIMESTAMP, ${input.createdBy}
      )
    `;
  } catch (error) {
    if (installmentIds.length > 0) await releaseInstallmentsByPayment(id);
    throw error;
  }
  await updateInvoiceWorkflow(input.invoiceNo, status, nextPaid);
  const created = await getInvoiceEvent(id);
  if (!created) throw new FieldError("Ödeme kaydı oluşturulamadı");
  return created;
}

export async function deleteInvoiceEvent(id: string): Promise<void> {
  const existing = await getInvoiceEvent(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  await releaseInstallmentsByPayment(id);
  await prisma.$executeRaw`DELETE FROM "InvoiceEvent" WHERE "id" = ${id}`;
  if (existing.fileId) {
    try {
      await unlink(invoiceDocPath(existing.fileId));
    } catch {
      /* yoksa geç */
    }
  }
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNo: existing.invoiceNo } });
  if (!invoice) return;
  const paid = await paymentSum(existing.invoiceNo);
  const status =
    existing.kind === "payment"
      ? paymentStatusFor(asNumber(invoice.amount), paid)
      : normalizeInvoiceStatus(invoice.status);
  await updateInvoiceWorkflow(existing.invoiceNo, status, paid);
}
