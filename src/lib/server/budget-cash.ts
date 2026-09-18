import type { BudgetCashDirection, BudgetCashEntry } from "@/data/catalog";
import { isBudgetDocumented } from "@/lib/budget-cash";
import { prisma } from "@/lib/db";
import { FieldError } from "@/lib/server/fields";

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
  const documented = Boolean(row.documented) || Boolean(invoiceNo);
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
};

function normalize(input: BudgetCashWriteInput) {
  const party = input.party.trim();
  const category = input.category.trim();
  const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
  if (!party) throw new FieldError("Firma zorunludur");
  if (!category) throw new FieldError("Çeşit zorunludur");
  if (!(amount > 0)) throw new FieldError("Miktar pozitif olmalıdır");
  const invoiceNo = input.invoiceNo?.trim() ?? "";
  return {
    direction: input.direction === "gider" ? "gider" : "gelir",
    party,
    category,
    amount,
    date: input.date,
    dueDate: input.dueDate?.trim() ?? "",
    description: input.description?.trim() ?? "",
    invoiceNo,
    documented: isBudgetDocumented({ documented: false, invoiceNo }),
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

export async function createBudgetCashEntry(
  input: BudgetCashWriteInput,
  createdBy: string
): Promise<BudgetCashEntry> {
  const row = normalize(input);
  const id = `bce-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.$executeRaw`
    INSERT INTO "BudgetCashEntry" (
      "id", "direction", "party", "category", "amount", "date", "dueDate",
      "description", "invoiceNo", "documented", "createdAt", "createdBy"
    ) VALUES (
      ${id}, ${row.direction}, ${row.party}, ${row.category}, ${row.amount}, ${row.date},
      ${row.dueDate}, ${row.description}, ${row.invoiceNo}, ${row.documented},
      CURRENT_TIMESTAMP, ${createdBy}
    )
  `;
  const created = await getBudgetCashEntry(id);
  if (!created) throw new FieldError("Kasa kaydı oluşturulamadı");
  return created;
}

export async function updateBudgetCashEntry(
  id: string,
  input: Partial<BudgetCashWriteInput>
): Promise<BudgetCashEntry> {
  const existing = await getBudgetCashEntry(id);
  if (!existing) throw new FieldError("Kayıt bulunamadı");
  const next = normalize({
    direction: input.direction ?? existing.direction,
    party: input.party ?? existing.party,
    category: input.category ?? existing.category,
    amount: input.amount ?? existing.amount,
    date: input.date ?? existing.date,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
    description: input.description !== undefined ? input.description : existing.description,
    invoiceNo: input.invoiceNo !== undefined ? input.invoiceNo : existing.invoiceNo,
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
  await prisma.$executeRaw`DELETE FROM "BudgetCashEntry" WHERE "id" = ${id}`;
}
