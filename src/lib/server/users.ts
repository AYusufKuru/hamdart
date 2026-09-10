import { prisma } from "@/lib/db";
import { ROLES, type Role, type SessionUser } from "@/lib/auth/permissions";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { invalidateSessionCache } from "@/lib/auth/live-session";
import { logAudit } from "@/lib/server/audit";
import { capitalizeWordsTr } from "@/lib/utils";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  createdAt: string;
};

/** Kullanıcıya asla passwordHash dönmez */
const SAFE_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  active: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  createdAt: true,
} as const;

type SafeUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
};

function toRow(u: SafeUser): UserRow {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role as Role,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Girdi doğrulama hatalarını 400 ile ayırt etmek için */
export class UserInputError extends Error {}

function normalizeUsername(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new UserInputError("Kullanıcı adı zorunludur");
  }
  const username = raw.trim().toLowerCase();
  if (username.length < 3 || username.length > 32) {
    throw new UserInputError("Kullanıcı adı 3-32 karakter olmalıdır");
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new UserInputError(
      "Kullanıcı adı yalnızca küçük harf, rakam, nokta, alt çizgi ve tire içerebilir"
    );
  }
  return username;
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new UserInputError("Ad soyad zorunludur");
  }
  const name = capitalizeWordsTr(raw);
  if (name.length < 2 || name.length > 120) {
    throw new UserInputError("Ad soyad 2-120 karakter olmalıdır");
  }
  return name;
}

function normalizeRole(raw: unknown): Role {
  if (typeof raw !== "string" || !ROLES.includes(raw as Role)) {
    throw new UserInputError(
      `Geçersiz rol. Geçerli roller: ${ROLES.join(", ")}`
    );
  }
  return raw as Role;
}

/** Sistemde en az bir aktif yönetici kalmasını garanti eder */
async function assertNotLastActiveAdmin(
  userId: string,
  action: string
): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "ADMIN" || !target.active) return;

  const activeAdminCount = await prisma.user.count({
    where: { role: "ADMIN", active: true },
  });
  if (activeAdminCount <= 1) {
    throw new UserInputError(
      `Sistemdeki tek aktif yönetici ${action}. Önce başka bir yönetici hesabı oluşturun.`
    );
  }
}

export async function listUsers(): Promise<UserRow[]> {
  const rows = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ active: "desc" }, { username: "asc" }],
  });
  return rows.map(toRow);
}

export async function createUser(
  input: unknown,
  actor: SessionUser,
  ip?: string
): Promise<UserRow> {
  const body = (input ?? {}) as Record<string, unknown>;

  const username = normalizeUsername(body.username);
  const name = normalizeName(body.name);
  const role = normalizeRole(body.role);
  const password = typeof body.password === "string" ? body.password : "";

  const problem = validatePassword(password, { username, name });
  if (problem) throw new UserInputError(problem);

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new UserInputError("Bu kullanıcı adı zaten kullanılıyor");
  }

  const created = await prisma.user.create({
    data: {
      username,
      name,
      role,
      passwordHash: await hashPassword(password, { username, name }),
      // Yönetici belirlediği şifreyi kullanıcı ilk girişte değiştirmek zorunda
      mustChangePassword: true,
    },
    select: SAFE_SELECT,
  });

  await logAudit({
    actor: actor.name,
    action: "CREATE",
    entityType: "User",
    entityId: created.id,
    summary: `Kullanıcı oluşturuldu: ${username} (${role})`,
    after: { username, name, role },
    ipAddress: ip,
  });

  return toRow(created);
}

export async function updateUser(
  userId: string,
  input: unknown,
  actor: SessionUser,
  ip?: string
): Promise<UserRow> {
  const body = (input ?? {}) as Record<string, unknown>;

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_SELECT,
  });
  if (!before) {
    throw new UserInputError("Kullanıcı bulunamadı");
  }

  const data: {
    name?: string;
    role?: Role;
    active?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
    passwordChangedAt?: Date | null;
    tokenVersion?: { increment: number };
  } = {};

  if (body.name !== undefined) {
    data.name = normalizeName(body.name);
  }

  if (body.role !== undefined) {
    const role = normalizeRole(body.role);
    if (role !== before.role) {
      if (userId === actor.userId) {
        throw new UserInputError("Kendi rolünüzü değiştiremezsiniz");
      }
      if (before.role === "ADMIN") {
        await assertNotLastActiveAdmin(userId, "rolü değiştirilemez");
      }
    }
    data.role = role;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new UserInputError("active alanı true/false olmalıdır");
    }
    if (!body.active) {
      if (userId === actor.userId) {
        throw new UserInputError("Kendi hesabınızı kapatamazsınız");
      }
      await assertNotLastActiveAdmin(userId, "kapatılamaz");
    }
    data.active = body.active;
  }

  // Yönetici tarafından şifre sıfırlama
  if (body.password !== undefined) {
    const password = typeof body.password === "string" ? body.password : "";
    const problem = validatePassword(password, {
      username: before.username,
      name: data.name ?? before.name,
    });
    if (problem) throw new UserInputError(problem);
    data.passwordHash = await hashPassword(password, {
      username: before.username,
      name: data.name ?? before.name,
    });
    // Sıfırlanan şifreyi kullanıcı ilk girişte değiştirmek zorunda
    data.mustChangePassword = true;
    data.passwordChangedAt = null;
  }

  if (Object.keys(data).length === 0) {
    throw new UserInputError("Güncellenecek alan belirtilmedi");
  }

  const invalidatesSession =
    (data.role !== undefined && data.role !== before.role) ||
    (data.active !== undefined && data.active !== before.active) ||
    Boolean(data.passwordHash);

  if (invalidatesSession) {
    data.tokenVersion = { increment: 1 };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: SAFE_SELECT,
  });

  if (invalidatesSession) {
    invalidateSessionCache(userId);
  }

  const changes: string[] = [];
  if (data.name !== undefined && data.name !== before.name) changes.push("ad");
  if (data.role !== undefined && data.role !== before.role) {
    changes.push(`rol (${before.role} → ${data.role})`);
  }
  if (data.active !== undefined && data.active !== before.active) {
    changes.push(data.active ? "hesap açıldı" : "hesap kapatıldı");
  }
  if (data.passwordHash) changes.push("şifre sıfırlandı");

  await logAudit({
    actor: actor.name,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    summary: `Kullanıcı güncellendi: ${before.username} — ${
      changes.join(", ") || "değişiklik yok"
    }`,
    before: { name: before.name, role: before.role, active: before.active },
    after: { name: updated.name, role: updated.role, active: updated.active },
    ipAddress: ip,
  });

  return toRow(updated);
}

export async function deleteUser(
  userId: string,
  actor: SessionUser,
  ip?: string
): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_SELECT,
  });
  if (!target) {
    throw new UserInputError("Kullanıcı bulunamadı");
  }
  if (userId === actor.userId) {
    throw new UserInputError("Kendi hesabınızı silemezsiniz");
  }
  await assertNotLastActiveAdmin(userId, "silinemez");

  await prisma.user.delete({ where: { id: userId } });
  invalidateSessionCache(userId);

  await logAudit({
    actor: actor.name,
    action: "DELETE",
    entityType: "User",
    entityId: userId,
    summary: `Kullanıcı silindi: ${target.username} (${target.role})`,
    before: {
      username: target.username,
      name: target.name,
      role: target.role,
    },
    ipAddress: ip,
  });
}
