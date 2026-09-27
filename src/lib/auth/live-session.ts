/**
 * JWT oturumunu veritabanıyla doğrular.
 *
 * Proxy (Edge) Prisma kullanamaz; bu modül yalnızca Node tarafında
 * (route, sunucu bileşeni) import edilir. Kısa TTL'li bellek önbelleği
 * her istekte DB'ye gitmeyi önler; tokenVersion artınca önbellek düşer.
 */
import { prisma } from "@/lib/db";
import { normalizeGrants, type SessionUser } from "@/lib/auth/permissions";
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
  roleGrants: unknown;
  active: boolean;
  mustChangePassword: boolean;
  tokenVersion: number;
};

function toSession(user: DbUser): SessionUser | null {
  if (!user.active) return null;
  const grants = normalizeGrants(user.roleGrants, user.role);
  if (grants.length === 0) return null;
  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: grants[0].role,
    grants,
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
      roleGrants: true,
      active: true,
      mustChangePassword: true,
      tokenVersion: true,
    },
  });

  // Önbellek veritabanındaki güncel durumu tutar; eski token'ın sürümü ayrıca karşılaştırılır.
  const session = user ? toSession(user) : null;
  cache.set(jwt.userId, { expiresAt: now + CACHE_TTL_MS, session });
  if (!session || session.tokenVersion !== jwt.tokenVersion) return null;
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
