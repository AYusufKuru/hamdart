import type {
  ChequeDirection,
  ChequeInstallmentStatus,
  ChequeInstrumentStatus,
  ChequeKind,
  ChequeNote,
  ChequeNoteInstallment,
} from "@/data/catalog";
import { prisma } from "@/lib/db";
import { FieldError } from "@/lib/server/fields";
import { nextChequeDocNo, normalizeChequeStatus } from "@/lib/cheque-notes";
import { todayIso } from "@/lib/utils";

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

type NoteRow = Record<string, unknown>;

function toInstallment(row: NoteRow): ChequeNoteInstallment {
  const status = row.status === "Faturada" || row.status === "Karşılıksız" ? row.status : "Bekliyor";
  return {
    id: String(row.id ?? ""),
    chequeNoteId: String(row.chequeNoteId ?? ""),
    sequence: Number(row.sequence ?? 0),
    dueDate: String(row.dueDate ?? ""),
    amount: asNumber(row.amount),
    serialNo: String(row.serialNo ?? ""),
    status: status as ChequeInstallmentStatus,
    paidAt: String(row.paidAt ?? ""),
    invoiceNo: String(row.invoiceNo ?? ""),
    paymentEventId: String(row.paymentEventId ?? ""),
  };
}

function toNote(row: NoteRow, installments: ChequeNoteInstallment[]): ChequeNote {
  const kind: ChequeKind = row.kind === "senet" ? "senet" : "cek";
  const direction: ChequeDirection = row.direction === "given" ? "given" : "received";
  const status = normalizeChequeStatus(String(row.status ?? ""));
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt ?? "");
  return {
    id: String(row.id ?? ""),
    docNo: String(row.docNo ?? ""),
    kind,
    direction,
    party: String(row.party ?? ""),
    issueDate: String(row.issueDate ?? ""),
    bankName: String(row.bankName ?? ""),
    serialNo: String(row.serialNo ?? ""),
    totalAmount: asNumber(row.totalAmount),
    currency: String(row.currency ?? "TRY"),
    status,
    notes: String(row.notes ?? ""),
    relatedInvoiceNo: String(row.relatedInvoiceNo ?? ""),
    createdAt,
    createdBy: String(row.createdBy ?? ""),
    installments,
  };
}

async function listInstallments(noteIds: string[]): Promise<ChequeNoteInstallment[]> {
  if (noteIds.length === 0) return [];
  const rows = await prisma.$queryRaw<NoteRow[]>`
    SELECT * FROM "ChequeNoteInstallment"
    ORDER BY "sequence" ASC
  `;
  const allowed = new Set(noteIds);
  return rows.filter((row) => allowed.has(String(row.chequeNoteId))).map(toInstallment);
}

export async function listChequeNotes(): Promise<ChequeNote[]> {
  const notes = await prisma.$queryRaw<NoteRow[]>`
    SELECT * FROM "ChequeNote"
    ORDER BY "issueDate" DESC, "docNo" DESC
  `;
  const installments = await listInstallments(notes.map((row) => String(row.id)));
  const byNote = new Map<string, ChequeNoteInstallment[]>();
  for (const row of installments) {
    const list = byNote.get(row.chequeNoteId) ?? [];
    list.push(row);
    byNote.set(row.chequeNoteId, list);
  }
  return notes.map((row) => toNote(row, byNote.get(String(row.id)) ?? []));
}

export async function getChequeNote(id: string): Promise<ChequeNote | null> {
  const rows = await prisma.$queryRaw<NoteRow[]>`
    SELECT * FROM "ChequeNote" WHERE "id" = ${id} LIMIT 1
  `;
  if (!rows[0]) return null;
  const installments = await listInstallments([id]);
  return toNote(rows[0], installments);
}

export async function listAvailableInstallments(input: {
  kind?: ChequeKind | null;
  direction?: ChequeDirection | null;
  party?: string;
}): Promise<
  Array<
    ChequeNoteInstallment & {
      docNo: string;
      kind: ChequeKind;
      direction: ChequeDirection;
      party: string;
      bankName: string;
      currency: string;
    }
  >
> {
  const notes = await listChequeNotes();
  const party = input.party?.trim().toLocaleLowerCase("tr") ?? "";
  const rows = notes.flatMap((note) =>
    note.installments
      .filter((item) => item.status === "Bekliyor")
      .filter(() => !input.kind || note.kind === input.kind)
      .filter(() => !input.direction || note.direction === input.direction)
      .map((item) => ({
        ...item,
        docNo: note.docNo,
        kind: note.kind,
        direction: note.direction,
        party: note.party,
        bankName: note.bankName,
        currency: note.currency,
      }))
  );
  if (!party) return rows;
  return rows.sort((a, b) => {
    const aHit = a.party.trim().toLocaleLowerCase("tr") === party ? 0 : 1;
    const bHit = b.party.trim().toLocaleLowerCase("tr") === party ? 0 : 1;
    return aHit - bHit || a.dueDate.localeCompare(b.dueDate);
  });
}

export type ChequeNoteWriteInput = {
  kind: ChequeKind;
  direction: ChequeDirection;
  party: string;
  issueDate: string;
  bankName?: string;
  serialNo?: string;
  currency?: string;
  notes?: string;
  status?: ChequeInstrumentStatus;
  relatedInvoiceNo?: string;
  installments: Array<{ dueDate: string; amount: number; serialNo?: string }>;
};

function normalizeInstallments(input: ChequeNoteWriteInput["installments"]) {
  const rows = input
    .map((row, i) => ({
      sequence: i + 1,
      dueDate: row.dueDate,
      amount: Math.round((Number(row.amount) || 0) * 100) / 100,
      serialNo: row.serialNo?.trim() ?? "",
    }))
    .filter((row) => row.amount > 0);
  if (rows.length === 0) throw new FieldError("En az bir vade tutarı girin");
  return rows;
}

async function existingDocNos() {
  const rows = await prisma.$queryRaw<Array<{ docNo: string }>>`
    SELECT "docNo" FROM "ChequeNote"
  `;
  return rows.map((row) => row.docNo);
}

export async function createChequeNote(
  input: ChequeNoteWriteInput,
  createdBy: string
): Promise<ChequeNote> {
  const installments = normalizeInstallments(input.installments);
  const totalAmount = Math.round(installments.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  const docNo = nextChequeDocNo(await existingDocNos(), input.kind);
  const id = `chn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.$executeRaw`
    INSERT INTO "ChequeNote" (
      "id", "docNo", "kind", "direction", "party", "issueDate", "bankName", "serialNo",
      "totalAmount", "currency", "status", "notes", "relatedInvoiceNo", "createdAt", "createdBy"
    ) VALUES (
      ${id}, ${docNo}, ${input.kind}, ${input.direction}, ${input.party.trim()}, ${input.issueDate},
      ${input.bankName?.trim() ?? ""}, ${input.serialNo?.trim() ?? ""}, ${totalAmount},
      ${input.currency?.trim() || "TRY"}, ${normalizeChequeStatus(input.status ?? "Bekliyor")}, ${input.notes?.trim() ?? ""},
      ${input.relatedInvoiceNo?.trim() ?? ""}, CURRENT_TIMESTAMP, ${createdBy}
    )
  `;
  for (const row of installments) {
    const iid = `chi-${Date.now()}-${row.sequence}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.$executeRaw`
      INSERT INTO "ChequeNoteInstallment" (
        "id", "chequeNoteId", "sequence", "dueDate", "amount", "serialNo",
        "status", "paidAt", "invoiceNo", "paymentEventId"
      ) VALUES (
        ${iid}, ${id}, ${row.sequence}, ${row.dueDate}, ${row.amount}, ${row.serialNo},
        'Bekliyor', '', '', ''
      )
    `;
  }
  const created = await getChequeNote(id);
  if (!created) throw new FieldError("Çek / senet kaydı oluşturulamadı");
  return created;
}

export async function updateChequeNote(
  id: string,
  input: Partial<ChequeNoteWriteInput>
): Promise<ChequeNote> {
  const existing = await getChequeNote(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  const used = existing.installments.some((row) => row.status !== "Bekliyor");
  const party = input.party?.trim() || existing.party;
  const issueDate = input.issueDate || existing.issueDate;
  const bankName = input.bankName !== undefined ? input.bankName.trim() : existing.bankName;
  const serialNo = input.serialNo !== undefined ? input.serialNo.trim() : existing.serialNo;
  const notes = input.notes !== undefined ? input.notes.trim() : existing.notes;
  const relatedInvoiceNo =
    input.relatedInvoiceNo !== undefined ? input.relatedInvoiceNo.trim() : existing.relatedInvoiceNo;
  const status = input.status ? normalizeChequeStatus(input.status) : existing.status;
  let totalAmount = existing.totalAmount;
  if (input.installments) {
    if (used) throw new FieldError("Kullanılmış vadelerin tutarı değiştirilemez");
    const installments = normalizeInstallments(input.installments);
    totalAmount = Math.round(installments.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    await prisma.$executeRaw`DELETE FROM "ChequeNoteInstallment" WHERE "chequeNoteId" = ${id}`;
    for (const row of installments) {
      const iid = `chi-${Date.now()}-${row.sequence}-${Math.random().toString(36).slice(2, 6)}`;
      await prisma.$executeRaw`
        INSERT INTO "ChequeNoteInstallment" (
          "id", "chequeNoteId", "sequence", "dueDate", "amount", "serialNo",
          "status", "paidAt", "invoiceNo", "paymentEventId"
        ) VALUES (
          ${iid}, ${id}, ${row.sequence}, ${row.dueDate}, ${row.amount}, ${row.serialNo},
          'Bekliyor', '', '', ''
        )
      `;
    }
  }
  await prisma.$executeRaw`
    UPDATE "ChequeNote"
    SET "party" = ${party},
        "issueDate" = ${issueDate},
        "bankName" = ${bankName},
        "serialNo" = ${serialNo},
        "totalAmount" = ${totalAmount},
        "notes" = ${notes},
        "status" = ${status},
        "relatedInvoiceNo" = ${relatedInvoiceNo}
    WHERE "id" = ${id}
  `;
  const updated = await getChequeNote(id);
  if (!updated) throw new FieldError("Kayıt güncellenemedi");
  return updated;
}

export async function deleteChequeNote(id: string): Promise<void> {
  const existing = await getChequeNote(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  if (existing.installments.some((row) => row.status !== "Bekliyor")) {
    throw new FieldError("Faturaya bağlanmış çek / senet silinemez");
  }
  await prisma.$executeRaw`DELETE FROM "ChequeNote" WHERE "id" = ${id}`;
}

export async function applyInstallmentsToPayment(input: {
  installmentIds: string[];
  invoiceNo: string;
  paymentEventId: string;
}): Promise<number> {
  const ids = [...new Set(input.installmentIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new FieldError("Ödeme için çek / senet seçin");
  const rows: NoteRow[] = [];
  for (const id of ids) {
    const found = await prisma.$queryRaw<NoteRow[]>`
      SELECT * FROM "ChequeNoteInstallment" WHERE "id" = ${id} LIMIT 1
    `;
    if (!found[0]) throw new FieldError("Seçilen çek / senet bulunamadı");
    rows.push(found[0]);
  }
  let total = 0;
  const noteIds = new Set<string>();
  const today = todayIso();
  for (const row of rows) {
    if (String(row.status) !== "Bekliyor") {
      throw new FieldError("Seçilen vadelerden biri zaten kullanılmış");
    }
    total += asNumber(row.amount);
    noteIds.add(String(row.chequeNoteId));
    await prisma.$executeRaw`
      UPDATE "ChequeNoteInstallment"
      SET "status" = 'Faturada',
          "invoiceNo" = ${input.invoiceNo},
          "paymentEventId" = ${input.paymentEventId},
          "paidAt" = ${today}
      WHERE "id" = ${String(row.id)}
    `;
  }
  for (const noteId of noteIds) {
    const note = await getChequeNote(noteId);
    if (!note) continue;
    const related = note.relatedInvoiceNo || input.invoiceNo;
    await prisma.$executeRaw`
      UPDATE "ChequeNote"
      SET "relatedInvoiceNo" = ${related}
      WHERE "id" = ${noteId}
    `;
  }
  return Math.round(total * 100) / 100;
}

export async function releaseInstallmentsByPayment(paymentEventId: string): Promise<void> {
  if (!paymentEventId) return;
  await prisma.$executeRaw`
    UPDATE "ChequeNoteInstallment"
    SET "status" = 'Bekliyor',
        "invoiceNo" = '',
        "paymentEventId" = '',
        "paidAt" = ''
    WHERE "paymentEventId" = ${paymentEventId}
  `;
}
