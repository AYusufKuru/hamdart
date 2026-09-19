import type { CashAccount, CashAccountKind, CashCurrency } from "@/lib/cash-accounts";
import {
  isCashCurrency,
  SYSTEM_CASH_REGISTERS,
} from "@/lib/cash-accounts";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { ConflictError, FieldError } from "@/lib/server/fields";

type CashAccountDbRow = Record<string, unknown>;

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

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function toAccount(row: CashAccountDbRow, movement = 0): CashAccount {
  const kind: CashAccountKind = row.kind === "bank" ? "bank" : "cash";
  const currencyRaw = String(row.currency ?? "TRY").toUpperCase();
  const currency: CashCurrency = isCashCurrency(currencyRaw) ? currencyRaw : "TRY";
  const openingBalance = asNumber(row.openingBalance);
  return {
    id: String(row.id ?? ""),
    kind,
    name: String(row.name ?? "").trim(),
    locked: Boolean(row.locked),
    currency,
    openingBalance,
    balance: roundMoney(openingBalance + movement),
    bankName: String(row.bankName ?? "").trim(),
    iban: String(row.iban ?? "").trim(),
    branch: String(row.branch ?? "").trim(),
    accountNo: String(row.accountNo ?? "").trim(),
    notes: String(row.notes ?? "").trim(),
    active: row.active !== false,
    createdAt: toIso(row.createdAt),
  };
}

async function movementByAccount(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "cashAccountId",
           SUM(CASE WHEN "direction" = 'gider' THEN -"amount" ELSE "amount" END) AS delta
    FROM "BudgetCashEntry"
    WHERE "cashAccountId" <> ''
    GROUP BY "cashAccountId"
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.cashAccountId ?? "").trim();
    if (!id) continue;
    map.set(id, asNumber(row.delta));
  }
  return map;
}

async function toAccountWithBalance(row: CashAccountDbRow): Promise<CashAccount> {
  const id = String(row.id ?? "");
  const movements = await movementByAccount();
  return toAccount(row, movements.get(id) ?? 0);
}

function newBankId() {
  return `bank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIban(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function findById(id: string): Promise<CashAccountDbRow | null> {
  const rows = await prisma.$queryRaw<CashAccountDbRow[]>`
    SELECT * FROM "CashAccount" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findAll(): Promise<CashAccountDbRow[]> {
  return prisma.$queryRaw<CashAccountDbRow[]>`
    SELECT * FROM "CashAccount"
    ORDER BY "kind" ASC, "name" ASC
  `;
}

async function insertCashRegister(id: string, name: string) {
  await prisma.$executeRaw`
    INSERT INTO "CashAccount" (
      "id", "kind", "name", "locked", "currency", "openingBalance",
      "bankName", "iban", "branch", "accountNo", "notes", "active",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, 'cash', ${name}, true, 'TRY', 0,
      '', '', '', '', '', true,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO NOTHING
  `;
}

async function ensureSystemCashRegisters() {
  for (const row of SYSTEM_CASH_REGISTERS) {
    await insertCashRegister(row.id, row.name);
  }
}

export async function listCashAccounts(): Promise<CashAccount[]> {
  await ensureSystemCashRegisters();
  const [rows, movements] = await Promise.all([findAll(), movementByAccount()]);
  return rows
    .map((row) => toAccount(row, movements.get(String(row.id ?? "")) ?? 0))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "cash" ? -1 : 1;
      return a.name.localeCompare(b.name, "tr");
    });
}

export type CashAccountWriteInput = {
  name: string;
  bankName?: string;
  iban?: string;
  branch?: string;
  accountNo?: string;
  currency?: string;
  openingBalance?: number;
  notes?: string;
};

function normalizeBank(input: CashAccountWriteInput) {
  const name = input.name.trim();
  const bankName = (input.bankName ?? "").trim();
  if (!name) throw new FieldError("Hesap adı zorunludur");
  if (!bankName) throw new FieldError("Banka adı zorunludur");
  const currencyRaw = (input.currency ?? "TRY").trim().toUpperCase();
  const currency: CashCurrency = isCashCurrency(currencyRaw) ? currencyRaw : "TRY";
  return {
    name,
    bankName,
    iban: normalizeIban(input.iban),
    branch: (input.branch ?? "").trim(),
    accountNo: (input.accountNo ?? "").trim(),
    currency,
    openingBalance: roundMoney(input.openingBalance ?? 0),
    notes: (input.notes ?? "").trim(),
  };
}

export async function createBankAccount(
  input: CashAccountWriteInput,
  ctx: { actor: string; ip?: string }
): Promise<CashAccount> {
  const row = normalizeBank(input);
  const id = newBankId();
  await prisma.$executeRaw`
    INSERT INTO "CashAccount" (
      "id", "kind", "name", "locked", "currency", "openingBalance",
      "bankName", "iban", "branch", "accountNo", "notes", "active",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, 'bank', ${row.name}, false, ${row.currency}, ${row.openingBalance},
      ${row.bankName}, ${row.iban}, ${row.branch}, ${row.accountNo}, ${row.notes}, true,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  const createdRow = await findById(id);
  if (!createdRow) throw new FieldError("Banka hesabı oluşturulamadı");
  const created = await toAccountWithBalance(createdRow);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "CashAccount",
    entityId: created.id,
    summary: `Banka hesabı eklendi: ${created.bankName} / ${created.name}`,
    after: created,
    ipAddress: ctx.ip,
  });
  return created;
}

export async function updateCashAccount(
  id: string,
  input: Partial<CashAccountWriteInput>,
  ctx: { actor: string; ip?: string }
): Promise<CashAccount> {
  const beforeRow = await findById(id);
  if (!beforeRow) throw new FieldError("Kayıt bulunamadı");
  const before = await toAccountWithBalance(beforeRow);

  if (before.kind === "cash") {
    const openingBalance =
      input.openingBalance !== undefined
        ? roundMoney(input.openingBalance)
        : before.openingBalance;
    const notes = input.notes !== undefined ? input.notes.trim() : before.notes;
    await prisma.$executeRaw`
      UPDATE "CashAccount"
      SET "openingBalance" = ${openingBalance},
          "notes" = ${notes},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  } else {
    const next = normalizeBank({
      name: input.name ?? before.name,
      bankName: input.bankName ?? before.bankName,
      iban: input.iban ?? before.iban,
      branch: input.branch ?? before.branch,
      accountNo: input.accountNo ?? before.accountNo,
      currency: input.currency ?? before.currency,
      openingBalance: input.openingBalance ?? before.openingBalance,
      notes: input.notes ?? before.notes,
    });
    await prisma.$executeRaw`
      UPDATE "CashAccount"
      SET "name" = ${next.name},
          "bankName" = ${next.bankName},
          "iban" = ${next.iban},
          "branch" = ${next.branch},
          "accountNo" = ${next.accountNo},
          "currency" = ${next.currency},
          "openingBalance" = ${next.openingBalance},
          "notes" = ${next.notes},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  }

  const afterRow = await findById(id);
  if (!afterRow) throw new FieldError("Kayıt güncellenemedi");
  const after = await toAccountWithBalance(afterRow);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "CashAccount",
    entityId: id,
    summary:
      before.kind === "cash"
        ? `Kasa güncellendi: ${after.name}`
        : `Banka hesabı güncellendi: ${after.name}`,
    before,
    after,
    ipAddress: ctx.ip,
  });
  return after;
}

export async function deleteCashAccount(
  id: string,
  ctx: { actor: string; ip?: string }
): Promise<void> {
  const beforeRow = await findById(id);
  if (!beforeRow) throw new FieldError("Kayıt bulunamadı");
  const before = await toAccountWithBalance(beforeRow);
  if (before.locked || before.kind === "cash") {
    throw new ConflictError("Sistem kasaları silinemez");
  }
  await prisma.$executeRaw`DELETE FROM "CashAccount" WHERE "id" = ${id}`;
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "CashAccount",
    entityId: id,
    summary: `Banka hesabı silindi: ${before.bankName} / ${before.name}`,
    before,
    ipAddress: ctx.ip,
  });
}
