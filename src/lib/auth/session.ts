import { SignJWT, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { cookieSecure } from "@/lib/auth/cookie-secure";
import type { Role, SessionUser } from "@/lib/auth/permissions";

export const SESSION_COOKIE = "hamdart-session";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 saat

export type SessionPayload = SessionUser;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET en az 32 karakter olmalıdır");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = payload.userId as string;
    const username = payload.username as string;
    const name = payload.name as string;
    const role = payload.role as Role;
    if (!userId || !username || !name || !role) return null;
    const tokenVersion = Number(payload.tokenVersion);
    if (!Number.isInteger(tokenVersion) || tokenVersion < 0) return null;
    return {
      userId,
      username,
      name,
      role,
      mustChangePassword: payload.mustChangePassword === true,
      tokenVersion,
    };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifySessionToken(token);
}

/** Sunucu bileşenleri için oturum okuma (NextRequest olmadan) */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function applyCookie(
  response: NextResponse,
  opts: ReturnType<typeof sessionCookieOptions> | ReturnType<typeof clearSessionCookieOptions>
): void {
  response.cookies.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAge,
  });
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  };
}
