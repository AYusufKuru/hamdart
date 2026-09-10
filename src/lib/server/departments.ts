import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import { ConflictError, FieldError } from "@/lib/server/fields";
import { capitalizeWordsTr } from "@/lib/utils";

export type DepartmentRow = {
  id: string;
  name: string;
  createdAt: string;
};

function toRow(row: { id: string; name: string; createdAt: Date }): DepartmentRow {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
  });
  return rows
    .map(toRow)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function createDepartment(
  name: string,
  ctx: { actor: string; ip?: string }
): Promise<DepartmentRow> {
  const normalized = capitalizeWordsTr(name);
  const existing = await prisma.department.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
  });
  if (existing) throw new ConflictError("Bu departman zaten kayıtlı");

  const row = await prisma.department.create({
    data: { name: normalized },
  });
  const mapped = toRow(row);
  await logAudit({
    actor: ctx.actor,
    action: "CREATE",
    entityType: "Department",
    entityId: mapped.id,
    summary: `Departman eklendi: ${mapped.name}`,
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function updateDepartment(
  id: string,
  name: string,
  ctx: { actor: string; ip?: string }
): Promise<DepartmentRow> {
  const before = await prisma.department.findUnique({ where: { id } });
  if (!before) throw new FieldError("Departman bulunamadı");

  const normalized = capitalizeWordsTr(name);
  const clash = await prisma.department.findFirst({
    where: {
      id: { not: id },
      name: { equals: normalized, mode: "insensitive" },
    },
  });
  if (clash) throw new ConflictError("Bu departman adı zaten kullanılıyor");

  const row = await prisma.department.update({
    where: { id },
    data: { name: normalized },
  });

  if (before.name !== normalized) {
    await prisma.$transaction([
      prisma.personnel.updateMany({
        where: { department: before.name },
        data: { department: normalized },
      }),
      prisma.budgetRow.updateMany({
        where: { department: before.name },
        data: { department: normalized },
      }),
      prisma.labExperiment.updateMany({
        where: { department: before.name },
        data: { department: normalized },
      }),
    ]);
  }

  const mapped = toRow(row);
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    entityType: "Department",
    entityId: id,
    summary: `Departman güncellendi: ${before.name} → ${mapped.name}`,
    before: toRow(before),
    after: mapped,
    ipAddress: ctx.ip,
  });
  return mapped;
}

export async function deleteDepartment(
  id: string,
  ctx: { actor: string; ip?: string }
): Promise<void> {
  const before = await prisma.department.findUnique({ where: { id } });
  if (!before) throw new FieldError("Departman bulunamadı");

  const [personnelCount, budgetCount, labCount] = await Promise.all([
    prisma.personnel.count({ where: { department: before.name } }),
    prisma.budgetRow.count({ where: { department: before.name } }),
    prisma.labExperiment.count({ where: { department: before.name } }),
  ]);
  const used = personnelCount + budgetCount + labCount;
  if (used > 0) {
    throw new ConflictError(
      `Bu departman ${used} kayıtta kullanılıyor; önce kayıtları güncelleyin`
    );
  }

  await prisma.department.delete({ where: { id } });
  await logAudit({
    actor: ctx.actor,
    action: "DELETE",
    entityType: "Department",
    entityId: id,
    summary: `Departman silindi: ${before.name}`,
    before: toRow(before),
    ipAddress: ctx.ip,
  });
}
