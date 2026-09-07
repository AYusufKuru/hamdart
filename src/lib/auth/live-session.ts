/**
 * JWT oturumunu veritabanıyla doğrular.
 *
 * Proxy (Edge) Prisma kullanamaz; bu modül yalnızca Node tarafında
 * (route, sunucu bileşeni) import edilir. Kısa TTL'li bellek önbelleği
 * her istekte DB'ye gitmeyi önler; tokenVersion artınca önbellek düşer.
 */
import { prisma } from "@/lib/db";
import { ROLES, type Role, type SessionUser } from "@/lib/auth/permissions";
import {
  getSessionFromRequest,
  verifySessionToken,
  SESSION_COOKIE,
  type SessionPayload,
} from "@/lib/auth/session";
import type { NextRequest } from "next/server";

const CACHE_TTL_MS = 3_000;

type Cached = { expiresAt: number; session: SessionUser | null };

const cache = new Map<string, Cached>();

export function invalidateSessionCache(userId: string): void {
  cache.delete(userId);
}

type DbUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  tokenVersion: number;
};

function toSession(user: DbUser): SessionUser | null {
  if (!user.active) return null;
  if (!ROLES.includes(user.role as Role)) return null;
  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
    mustChangePassword: user.mustChangePassword,
    tokenVersion: user.tokenVersion,
  };
}

async function hydrate(jwt: SessionPayload): Promise<SessionUser | null> {
  const now = Date.now();
  const hit = cache.get(jwt.userId);
  if (hit && hit.expiresAt > now) {
    if (!hit.session) return null;
    if (hit.session.tokenVersion !== jwt.tokenVersion) return null;
    return hit.session;
  }

  const user = await prisma.user.findUnique({
    where: { id: jwt.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      mustChangePassword: true,
      tokenVersion: true,
    },
  });

  if (!user || user.tokenVersion !== jwt.tokenVersion) {
    cache.set(jwt.userId, { expiresAt: now + CACHE_TTL_MS, session: null });
    return null;
  }

  const session = toSession(user);
  cache.set(jwt.userId, { expiresAt: now + CACHE_TTL_MS, session });
  return session;
}

export async function getLiveSessionFromRequest(
  req: NextRequest
): Promise<SessionUser | null> {
  const jwt = await getSessionFromRequest(req);
  if (!jwt) return null;
  return hydrate(jwt);
}

export async function getLiveSessionFromCookies(): Promise<SessionUser | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const jwt = await verifySessionToken(token);
  if (!jwt) return null;
  return hydrate(jwt);
}
