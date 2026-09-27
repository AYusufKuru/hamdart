import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canAssignRole,
  canManageUser,
  grantsLabel,
  isRole,
  isSystemAdmin,
  normalizeGrants,
  ROLES,
  type Role,
  type RoleGrant,
  type SessionUser,
} from "@/lib/auth/permissions";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { invalidateSessionCache } from "@/lib/auth/live-session";
import { logAudit } from "@/lib/server/audit";
import { capitalizeWordsTr } from "@/lib/utils";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  /** Birincil rol */
  role: Role;
  grants: RoleGrant[];
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
  roleGrants: true,
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
  roleGrants: unknown;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
};

function grantsOfUser(u: { role: string; roleGrants: unknown }): RoleGrant[] {
  return normalizeGrants(u.roleGrants, u.role);
}

function rolesOf(grants: readonly RoleGrant[]): Role[] {
  return grants.map((g) => g.role);
}

function hasSystemAdmin(grants: readonly RoleGrant[]): boolean {
  return grants.some((g) => g.role === "SYSTEM_ADMIN");
}

function sameGrants(a: readonly RoleGrant[], b: readonly RoleGrant[]): boolean {
  return (
    a.length === b.length &&
    a.every((g, i) => g.role === b[i].role && g.access === b[i].access)
  );
}

function toRow(u: SafeUser): UserRow {
  const grants = grantsOfUser(u);
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: grants[0]?.role ?? (u.role as Role),
    grants,
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

/** `grants` listesi veya tek `role` alanından rol listesi */
function readGrantsInput(body: Record<string, unknown>): RoleGrant[] {
  if (Array.isArray(body.grants)) {
    const grants = normalizeGrants(body.grants);
    if (grants.length === 0) {
      throw new UserInputError("En az bir rol seçin");
    }
    return grants;
  }
  if (isRole(body.role)) return [{ role: body.role, access: "edit" }];
  throw new UserInputError(`Geçersiz rol. Geçerli roller: ${ROLES.join(", ")}`);
}

function assertCanAssign(actor: SessionUser, grants: readonly RoleGrant[]): void {
  if (!grants.every((g) => canAssignRole(actor, g.role))) {
    throw new UserInputError("Seçilen rollerden birini atama yetkiniz yok");
  }
}

function assertCanManageTarget(actor: SessionUser, targetGrants: readonly RoleGrant[]): void {
  if (!canManageUser(actor, rolesOf(targetGrants))) {
    throw new UserInputError("Bu kullanıcı üzerinde işlem yapamazsınız");
  }
}

/** Sistemde en az bir aktif sistem yöneticisi kalmasını garanti eder */
async function assertNotLastActiveSystemAdmin(
  userId: string,
  action: string
): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !target.active || !hasSystemAdmin(grantsOfUser(target))) return;

  // Birincil rol, rol listesindeki en yetkili roldür; sistem yöneticisi her zaman öndedir.
  const activeCount = await prisma.user.count({
    where: { role: "SYSTEM_ADMIN", active: true },
  });
  if (activeCount <= 1) {
    throw new UserInputError(
      `Sistemdeki tek aktif sistem yöneticisi ${action}. Önce başka bir sistem yöneticisi hesabı oluşturun.`
    );
  }
}

export async function listUsers(actor: SessionUser): Promise<UserRow[]> {
  const rows = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ active: "desc" }, { username: "asc" }],
  });
  const mapped = rows.map(toRow);
  return isSystemAdmin(actor) ? mapped : mapped.filter((u) => !hasSystemAdmin(u.grants));
}

export async function createUser(
  input: unknown,
  actor: SessionUser,
  ip?: string
): Promise<UserRow> {
  const body = (input ?? {}) as Record<string, unknown>;

  const username = normalizeUsername(body.username);
  const name = normalizeName(body.name);
  const grants = readGrantsInput(body);
  assertCanAssign(actor, grants);
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
      role: grants[0].role,
      roleGrants: grants as unknown as Prisma.InputJsonValue,
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
    summary: `Kullanıcı oluşturuldu: ${username} (${grantsLabel(grants)})`,
    after: { username, name, grants },
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
  const beforeGrants = grantsOfUser(before);
  assertCanManageTarget(actor, beforeGrants);

  const data: {
    name?: string;
    role?: Role;
    roleGrants?: Prisma.InputJsonValue;
    active?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
    passwordChangedAt?: Date | null;
    tokenVersion?: { increment: number };
  } = {};
  let nextGrants: RoleGrant[] | null = null;

  if (body.name !== undefined) {
    data.name = normalizeName(body.name);
  }

  if (body.grants !== undefined || body.role !== undefined) {
    const grants = readGrantsInput(body);
    assertCanAssign(actor, grants);
    if (!sameGrants(grants, beforeGrants)) {
      if (userId === actor.userId) {
        throw new UserInputError("Kendi rollerinizi değiştiremezsiniz");
      }
      if (hasSystemAdmin(beforeGrants) && !hasSystemAdmin(grants)) {
        await assertNotLastActiveSystemAdmin(userId, "rolü değiştirilemez");
      }
      nextGrants = grants;
      data.role = grants[0].role;
      data.roleGrants = grants as unknown as Prisma.InputJsonValue;
    }
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new UserInputError("active alanı true/false olmalıdır");
    }
    if (!body.active) {
      if (userId === actor.userId) {
        throw new UserInputError("Kendi hesabınızı kapatamazsınız");
      }
      await assertNotLastActiveSystemAdmin(userId, "kapatılamaz");
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

  if (
    Object.keys(data).length === 0 &&
    body.grants === undefined &&
    body.role === undefined
  ) {
    throw new UserInputError("Güncellenecek alan belirtilmedi");
  }
  if (Object.keys(data).length === 0) {
    return toRow(before);
  }

  const invalidatesSession =
    nextGrants !== null ||
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
  if (nextGrants) {
    changes.push(`roller (${grantsLabel(beforeGrants)} → ${grantsLabel(nextGrants)})`);
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
    before: { name: before.name, grants: beforeGrants, active: before.active },
    after: { name: updated.name, grants: grantsOfUser(updated), active: updated.active },
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
  const targetGrants = grantsOfUser(target);
  assertCanManageTarget(actor, targetGrants);
  await assertNotLastActiveSystemAdmin(userId, "silinemez");

  await prisma.user.delete({ where: { id: userId } });
  invalidateSessionCache(userId);

  await logAudit({
    actor: actor.name,
    action: "DELETE",
    entityType: "User",
    entityId: userId,
    summary: `Kullanıcı silindi: ${target.username} (${grantsLabel(targetGrants)})`,
    before: {
      username: target.username,
      name: target.name,
      grants: targetGrants,
    },
    ipAddress: ip,
  });
}
