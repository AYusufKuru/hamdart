import type { BudgetCashDirection, BudgetCategory } from "@/data/catalog";
import { prisma } from "@/lib/db";
import { FieldError } from "@/lib/server/fields";

type CategoryRow = Record<string, unknown>;

function toCategory(row: CategoryRow): BudgetCategory {
  return {
    id: String(row.id ?? ""),
    direction: row.direction === "gider" ? "gider" : "gelir",
    name: String(row.name ?? "").trim(),
  };
}

function nameKey(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

export async function listBudgetCategories(): Promise<BudgetCategory[]> {
  const rows = await prisma.$queryRaw<CategoryRow[]>`
    SELECT * FROM "BudgetCategory"
    ORDER BY "direction" ASC, "name" ASC
  `;
  return rows.map(toCategory).filter((row) => row.name);
}

export async function createBudgetCategory(input: {
  direction: BudgetCashDirection;
  name: string;
}): Promise<BudgetCategory> {
  const name = input.name.trim();
  const direction = input.direction === "gider" ? "gider" : "gelir";
  if (!name) throw new FieldError("Çeşit adı zorunludur");
  const existing = await prisma.$queryRaw<CategoryRow[]>`
    SELECT "name" FROM "BudgetCategory" WHERE "direction" = ${direction}
  `;
  if (existing.some((row) => nameKey(String(row.name ?? "")) === nameKey(name))) {
    throw new FieldError("Bu çeşit zaten var");
  }
  const id = `bcat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.$executeRaw`
    INSERT INTO "BudgetCategory" ("id", "direction", "name")
    VALUES (${id}, ${direction}, ${name})
  `;
  return { id, direction, name };
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  const rows = await prisma.$queryRaw<CategoryRow[]>`
    SELECT * FROM "BudgetCategory" WHERE "id" = ${id} LIMIT 1
  `;
  if (!rows[0]) throw new FieldError("Çeşit bulunamadı");
  await prisma.$executeRaw`DELETE FROM "BudgetCategory" WHERE "id" = ${id}`;
}
