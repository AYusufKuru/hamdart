import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { ConflictError, FieldError } from "@/lib/server/fields";
import { LAB_WORKER_TITLE, parsePersonnelTitles } from "@/lib/personnel";
import { capitalizeWordsTr } from "@/lib/utils";

export type JobTitleRow = {
  id: string;
  name: string;
  createdAt: string;
};

type JobTitleDbRow = { id: string; name: string; createdAt: Date };

function toRow(row: JobTitleDbRow): JobTitleRow {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

function titleKey(name: string) {
  return name.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

function newId() {
  return `jt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function findAll(): Promise<JobTitleDbRow[]> {
  return prisma.$queryRaw<JobTitleDbRow[]>`
    SELECT "id", "name", "createdAt" FROM "JobTitle" ORDER BY "name" ASC
  `;
}

async function findByNameInsensitive(name: string): Promise<JobTitleDbRow | null> {
  const rows = await prisma.$queryRaw<JobTitleDbRow[]>`
    SELECT "id", "name", "createdAt" FROM "JobTitle"
    WHERE lower("name") = lower(${name})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findById(id: string): Promise<JobTitleDbRow | null> {
  const rows = await prisma.$queryRaw<JobTitleDbRow[]>`
    SELECT "id", "name", "createdAt" FROM "JobTitle" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function insertTitle(name: string): Promise<JobTitleDbRow> {
  const id = newId();
  await prisma.$executeRaw`
    INSERT INTO "JobTitle" ("id", "name", "createdAt", "updatedAt")
    VALUES (${id}, ${name}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  const row = await findById(id);
  if (!row) throw new FieldError("Görev kaydı oluşturulamadı");
  return row;
}

async function ensureDefaultJobTitles() {
  const exists = await findByNameInsensitive(LAB_WORKER_TITLE);
  if (!exists) await insertTitle(LAB_WORKER_TITLE);
}

async function syncTitlesFromPersonnel() {
  const [titles, personnel] = await Promise.all([
    findAll(),
    prisma.personnel.findMany({ select: { title: true } }),
  ]);
  const known = new Set(titles.map((row) => titleKey(row.name)));
  for (const person of personnel) {
    for (const part of parsePersonnelTitles(person.title)) {
      const key = titleKey(part);
      if (!key || known.has(key)) continue;
      known.add(key);
      await insertTitle(capitalizeWordsTr(part));
    }
  }
}

export async function listJobTitles(): Promise<JobTitleRow[]> {
  await ensureDefaultJobTitles();
  await syncTitlesFromPersonnel();
  const rows = await findAll();
  return rows.map(toRow).sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function createJobTitle(
  name: string,
  ctx: { actor: string; ip?: string }
): Promise<JobTitleRow> {
  const normalized = capitalizeWordsTr(name);
  const existing = await findByNameInsensitive(normalized);
  if (existing) throw new ConflictError("Bu görev zaten kayıtlı");

  const mapped = toRow(await insertTitle(normalized));
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "JobTitle",
    entityId: mapped.id,
    summary: `Görev eklendi: ${mapped.name}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function deleteJobTitle(
  id: string,
  ctx: { actor: string; ip?: string }
): Promise<void> {
  const before = await findById(id);
  if (!before) throw new FieldError("Görev bulunamadı");

  const personnel = await prisma.personnel.findMany({ select: { title: true } });
  const used = personnel.filter((row) =>
    parsePersonnelTitles(row.title).some((part) => titleKey(part) === titleKey(before.name))
  ).length;
  if (used > 0) {
    throw new ConflictError(
      `Bu görev ${used} personelde kullanılıyor; önce kayıtları güncelleyin`
    );
  }

  await prisma.$executeRaw`DELETE FROM "JobTitle" WHERE "id" = ${id}`;
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "JobTitle",
    entityId: id,
    summary: `Görev silindi: ${before.name}`,
    before: toRow(before),
    ipAddress: ctx.ip,
  });
}
