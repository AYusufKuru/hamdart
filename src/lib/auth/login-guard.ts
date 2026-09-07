/**
 * Giriş kaba kuvvet koruması.
 *
 * İki katman:
 *  1. Bellek içi oran sınırlama — IP+kullanıcı (15 dk / 10) ve IP (15 dk / 40)
 *  2. Veritabanı hesap kilidi — 5 başarısız denemede 15 dakika
 *
 * Tek süreçli Docker kurulumu için bellek yeterlidir. Süreç yeniden başlarsa
 * oran sayacı sıfırlanır; hesap kilidi veritabanında kalır.
 */
import { prisma } from "@/lib/db";
import { dummyVerifyPassword, verifyPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/server/audit";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_PAIR = 10;
export const LOGIN_MAX_PER_IP = 40;
export const LOCK_AFTER_FAILURES = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

const TOO_MANY =
  "Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.";

type Stamp = number[];
const pairAttempts = new Map<string, Stamp>();
const ipAttempts = new Map<string, Stamp>();

function prune(stamps: Stamp, now: number): Stamp {
  return stamps.filter((t) => now - t < LOGIN_WINDOW_MS);
}

function hit(map: Map<string, Stamp>, key: string, now: number): number {
  const next = prune(map.get(key) ?? [], now);
  next.push(now);
  map.set(key, next);
  return next.length;
}

function peek(map: Map<string, Stamp>, key: string, now: number): number {
  const next = prune(map.get(key) ?? [], now);
  map.set(key, next);
  return next.length;
}

function oldestRetryAfterSec(map: Map<string, Stamp>, key: string, now: number): number {
  const stamps = prune(map.get(key) ?? [], now);
  if (stamps.length === 0) return Math.ceil(LOGIN_WINDOW_MS / 1000);
  const oldest = Math.min(...stamps);
  return Math.max(1, Math.ceil((oldest + LOGIN_WINDOW_MS - now) / 1000));
}

export type LoginDenial = {
  status: 401 | 429;
  message: string;
  retryAfterSec?: number;
};

export type LoginOk = {
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    active: boolean;
    mustChangePassword: boolean;
    tokenVersion: number;
  };
};

function pairKey(ip: string, username: string): string {
  return `${ip}\0${username}`;
}

async function auditLogin(
  actor: string,
  summary: string,
  ip?: string,
  entityId?: string
): Promise<void> {
  try {
    await logAudit({
      actor,
      action: "ACTION",
      entityType: "Auth",
      entityId,
      summary,
      ipAddress: ip,
    });
  } catch (e) {
    console.error("Giriş denetim kaydı yazılamadı:", e);
  }
}

export async function authenticateLogin(
  username: string,
  password: string,
  ip: string
): Promise<LoginOk | { denied: LoginDenial }> {
  const now = Date.now();
  const pKey = pairKey(ip, username);

  if (peek(pairAttempts, pKey, now) >= LOGIN_MAX_PER_PAIR) {
    await auditLogin("anonim", `Giriş reddedildi (oran sınırı): ${username}`, ip);
    return {
      denied: {
        status: 429,
        message: TOO_MANY,
        retryAfterSec: oldestRetryAfterSec(pairAttempts, pKey, now),
      },
    };
  }
  if (peek(ipAttempts, ip, now) >= LOGIN_MAX_PER_IP) {
    await auditLogin("anonim", `Giriş reddedildi (IP oran sınırı): ${username}`, ip);
    return {
      denied: {
        status: 429,
        message: TOO_MANY,
        retryAfterSec: oldestRetryAfterSec(ipAttempts, ip, now),
      },
    };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  const countFailure = () => {
    hit(pairAttempts, pKey, now);
    hit(ipAttempts, ip, now);
  };

  if (!user) {
    countFailure();
    await dummyVerifyPassword(password);
    await auditLogin("anonim", `Giriş başarısız: ${username}`, ip);
    return {
      denied: { status: 401, message: "Geçersiz kullanıcı adı veya şifre" },
    };
  }

  const lockedUntil = user.lockedUntil?.getTime() ?? 0;
  if (lockedUntil > now) {
    countFailure();
    await verifyPassword(password, user.passwordHash);
    const retryAfterSec = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
    await auditLogin(
      user.name,
      `Giriş reddedildi (hesap kilitli): ${user.username}`,
      ip,
      user.id
    );
    return {
      denied: { status: 429, message: TOO_MANY, retryAfterSec },
    };
  }

  // Kilit süresi dolmuşsa sayacı bu denemeden önce sıfırla
  if (user.lockedUntil && lockedUntil <= now && user.failedAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    user.failedAttempts = 0;
    user.lockedUntil = null;
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid || !user.active) {
    countFailure();
    const attempts = user.failedAttempts + 1;
    const shouldLock = attempts >= LOCK_AFTER_FAILURES;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: attempts,
        lockedUntil: shouldLock ? new Date(now + LOCK_DURATION_MS) : null,
      },
    });
    await auditLogin(
      user.name,
      user.active
        ? `Giriş başarısız: ${user.username}`
        : `Giriş başarısız (hesap kapalı): ${user.username}`,
      ip,
      user.id
    );
    if (shouldLock) {
      return {
        denied: {
          status: 429,
          message: TOO_MANY,
          retryAfterSec: Math.ceil(LOCK_DURATION_MS / 1000),
        },
      };
    }
    return {
      denied: { status: 401, message: "Geçersiz kullanıcı adı veya şifre" },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  await auditLogin(user.name, `Giriş başarılı: ${user.username}`, ip, user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    },
  };
}
