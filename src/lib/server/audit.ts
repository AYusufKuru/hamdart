import { prisma } from "@/lib/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ACTION"
  | "BACKUP"
  | "RESTORE"
  | "SYNC";

export type AuditInput = {
  actor: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
};

function serialize(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return JSON.stringify(value);
}

export async function logAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      before: serialize(input.before),
      after: serialize(input.after),
      ipAddress: input.ipAddress,
    },
  });
}

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
};

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function listAuditLogs(options?: {
  limit?: number;
  entityType?: string;
  entityId?: string;
}): Promise<AuditLogRow[]> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 100));
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: options?.entityType,
      entityId: options?.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    before: parseJson(r.before),
    after: parseJson(r.after),
    ipAddress: r.ipAddress,
  }));
}
