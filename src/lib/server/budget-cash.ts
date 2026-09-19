import type { NextRequest } from "next/server";
import type { ZodType } from "zod";
import type { BudgetCashDirection, BudgetCashEntry } from "@/data/catalog";
import { isBudgetDocumented } from "@/lib/budget-cash";
import { prisma } from "@/lib/db";
import { jsonValidationError, parseBody } from "@/lib/server/api-utils";
import { FieldError } from "@/lib/server/fields";
import {
  INVOICE_DOC_MAX_BYTES,
  invoiceDocPath,
  saveInvoiceDocFile,
} from "@/lib/server/invoice-events";
import { unlink } from "fs/promises";

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

type EntryRow = Record<string, unknown>;

function toEntry(row: EntryRow): BudgetCashEntry {
  const invoiceNo = String(row.invoiceNo ?? "").trim();
  const fileId = String(row.fileId ?? "").trim();
  const documented = Boolean(row.documented) || Boolean(invoiceNo) || Boolean(fileId);
  const direction: BudgetCashDirection = row.direction === "gider" ? "gider" : "gelir";
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt ?? "");
  return {
    id: String(row.id ?? ""),
    direction,
    party: String(row.party ?? ""),
    category: String(row.category ?? ""),
    amount: asNumber(row.amount),
    date: String(row.date ?? ""),
    dueDate: String(row.dueDate ?? ""),
    description: String(row.description ?? ""),
    invoiceNo,
    cashAccountId: String(row.cashAccountId ?? ""),
    fileId,
    fileName: String(row.fileName ?? ""),
    mimeType: String(row.mimeType ?? ""),
    documented,
    createdAt,
    createdBy: String(row.createdBy ?? ""),
  };
}

export type BudgetCashWriteInput = {
  direction: BudgetCashDirection;
  party: string;
  category: string;
  amount: number;
  date: string;
  dueDate?: string;
  description?: string;
  invoiceNo?: string;
  cashAccountId?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  receiptMode?: "invoice" | "file";
};

export type BudgetDocFile = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

function formValue(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || undefined;
}

async function fileFromForm(form: FormData): Promise<BudgetDocFile | undefined> {
  const filePart = form.get("file");
  if (!(filePart instanceof File) || filePart.size <= 0) return undefined;
  if (filePart.size > INVOICE_DOC_MAX_BYTES) {
    throw new FieldError("Dosya 5 MB altında olmalıdır");
  }
  return {
    buffer: Buffer.from(await filePart.arrayBuffer()),
    mimeType: filePart.type || "application/octet-stream",
    originalName: filePart.name || "fis",
  };
}

export async function parseBudgetCashRequest<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<{ ok: true; data: T; file?: BudgetDocFile } | { ok: false; response: Response }> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const parsed = await parseBody(req, schema);
    if (!parsed.ok) return parsed;
    return { ok: true, data: parsed.data };
  }
  const form = await req.formData();
  const amountRaw = String(form.get("amount") ?? "").replace(",", ".").trim();
  const receiptMode = formValue(form, "receiptMode");
  const raw = {
    direction: formValue(form, "direction"),
    party: formValue(form, "party"),
    category: formValue(form, "category"),
    amount: amountRaw ? Number(amountRaw) : undefined,
    date: formValue(form, "date"),
    dueDate: form.get("dueDate") != null ? String(form.get("dueDate") ?? "").trim() : undefined,
    description: form.get("description") != null ? String(form.get("description") ?? "").trim() : undefined,
    invoiceNo: form.get("invoiceNo") != null ? String(form.get("invoiceNo") ?? "").trim() : undefined,
    cashAccountId: form.get("cashAccountId") != null ? String(form.get("cashAccountId") ?? "").trim() : undefined,
    receiptMode: receiptMode === "file" || receiptMode === "invoice" ? receiptMode : undefined,
  };
  const result = schema.safeParse(raw);
  if (!result.success) return { ok: false, response: jsonValidationError(result.error) };
  return { ok: true, data: result.data, file: await fileFromForm(form) };
}

async function removeDoc(fileId: string) {
  if (!fileId) return;
  try {
    await unlink(invoiceDocPath(fileId));
  } catch {
    /* already gone */
  }
}

function normalize(input: BudgetCashWriteInput) {
  const party = input.party.trim();
  const category = input.category.trim();
  const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
  if (!party) throw new FieldError("Firma zorunludur");
  if (!category) throw new FieldError("Çeşit zorunludur");
  if (!(amount > 0)) throw new FieldError("Miktar pozitif olmalıdır");
  const invoiceNo = input.invoiceNo?.trim() ?? "";
  const cashAccountId = input.cashAccountId?.trim() ?? "";
  const fileId = input.fileId?.trim() ?? "";
  const fileName = input.fileName?.trim() ?? "";
  const mimeType = input.mimeType?.trim() ?? "";
  if (input.direction !== "gider" && !cashAccountId) {
    throw new FieldError("Gelirin gideceği kasa veya banka hesabını seçin");
  }
  return {
    direction: input.direction === "gider" ? "gider" : "gelir",
    party,
    category,
    amount,
    date: input.date,
    dueDate: input.dueDate?.trim() ?? "",
    description: input.description?.trim() ?? "",
    invoiceNo,
    cashAccountId,
    fileId,
    fileName,
    mimeType,
    documented: isBudgetDocumented({ documented: false, invoiceNo, fileId }),
  };
}

export async function listBudgetCashEntries(): Promise<BudgetCashEntry[]> {
  const rows = await prisma.$queryRaw<EntryRow[]>`
    SELECT * FROM "BudgetCashEntry"
    ORDER BY "date" DESC, "createdAt" DESC
  `;
  return rows.map(toEntry);
}

export async function getBudgetCashEntry(id: string): Promise<BudgetCashEntry | null> {
  const rows = await prisma.$queryRaw<EntryRow[]>`
    SELECT * FROM "BudgetCashEntry" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ? toEntry(rows[0]) : null;
}

export async function getBudgetCashEntryByFileId(
  fileId: string
): Promise<BudgetCashEntry | null> {
  const rows = await prisma.$queryRaw<EntryRow[]>`
    SELECT * FROM "BudgetCashEntry" WHERE "fileId" = ${fileId} LIMIT 1
  `;
  return rows[0] ? toEntry(rows[0]) : null;
}

function resolveReceipt(
  input: Partial<BudgetCashWriteInput>,
  existing: Pick<BudgetCashEntry, "invoiceNo" | "fileId" | "fileName" | "mimeType"> | null,
  saved: { fileId: string; fileName: string; mimeType: string } | null
) {
  if (saved) {
    return { invoiceNo: "", ...saved };
  }
  if (input.receiptMode === "invoice") {
    return {
      invoiceNo: input.invoiceNo?.trim() ?? "",
      fileId: "",
      fileName: "",
      mimeType: "",
    };
  }
  if (input.receiptMode === "file") {
    return {
      invoiceNo: "",
      fileId: existing?.fileId ?? "",
      fileName: existing?.fileName ?? "",
      mimeType: existing?.mimeType ?? "",
    };
  }
  const invoiceNo =
    input.invoiceNo !== undefined ? input.invoiceNo.trim() : (existing?.invoiceNo ?? "");
  if (invoiceNo) {
    return { invoiceNo, fileId: "", fileName: "", mimeType: "" };
  }
  return {
    invoiceNo: "",
    fileId: existing?.fileId ?? "",
    fileName: existing?.fileName ?? "",
    mimeType: existing?.mimeType ?? "",
  };
}

export async function createBudgetCashEntry(
  input: BudgetCashWriteInput,
  createdBy: string,
  file?: BudgetDocFile
): Promise<BudgetCashEntry> {
  const saved = file ? await saveInvoiceDocFile(file) : null;
  const receipt = resolveReceipt(input, null, saved);
  const row = normalize({
    ...input,
    ...receipt,
  });
  const id = `bce-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.$executeRaw`
    INSERT INTO "BudgetCashEntry" (
      "id", "direction", "party", "category", "amount", "date", "dueDate",
      "description", "invoiceNo", "cashAccountId", "fileId", "fileName", "mimeType",
      "documented", "createdAt", "createdBy"
    ) VALUES (
      ${id}, ${row.direction}, ${row.party}, ${row.category}, ${row.amount}, ${row.date},
      ${row.dueDate}, ${row.description}, ${row.invoiceNo}, ${row.cashAccountId},
      ${row.fileId}, ${row.fileName}, ${row.mimeType}, ${row.documented},
      CURRENT_TIMESTAMP, ${createdBy}
    )
  `;
  const created = await getBudgetCashEntry(id);
  if (!created) throw new FieldError("Kasa kaydı oluşturulamadı");
  return created;
}

export async function updateBudgetCashEntry(
  id: string,
  input: Partial<BudgetCashWriteInput>,
  file?: BudgetDocFile
): Promise<BudgetCashEntry> {
  const existing = await getBudgetCashEntry(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  const saved = file ? await saveInvoiceDocFile(file) : null;
  const receipt = resolveReceipt(input, existing, saved);
  if (existing.fileId && existing.fileId !== receipt.fileId) {
    await removeDoc(existing.fileId);
  }
  const next = normalize({
    direction: input.direction ?? existing.direction,
    party: input.party ?? existing.party,
    category: input.category ?? existing.category,
    amount: input.amount ?? existing.amount,
    date: input.date ?? existing.date,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
    description: input.description !== undefined ? input.description : existing.description,
    cashAccountId:
      input.cashAccountId !== undefined ? input.cashAccountId : existing.cashAccountId,
    ...receipt,
  });
  await prisma.$executeRaw`
    UPDATE "BudgetCashEntry"
    SET "direction" = ${next.direction},
        "party" = ${next.party},
        "category" = ${next.category},
        "amount" = ${next.amount},
        "date" = ${next.date},
        "dueDate" = ${next.dueDate},
        "description" = ${next.description},
        "invoiceNo" = ${next.invoiceNo},
        "cashAccountId" = ${next.cashAccountId},
        "fileId" = ${next.fileId},
        "fileName" = ${next.fileName},
        "mimeType" = ${next.mimeType},
        "documented" = ${next.documented}
    WHERE "id" = ${id}
  `;
  const updated = await getBudgetCashEntry(id);
  if (!updated) throw new FieldError("Kayıt güncellenemedi");
  return updated;
}

export async function deleteBudgetCashEntry(id: string): Promise<void> {
  const existing = await getBudgetCashEntry(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  if (existing.fileId) await removeDoc(existing.fileId);
  await prisma.$executeRaw`DELETE FROM "BudgetCashEntry" WHERE "id" = ${id}`;
}
